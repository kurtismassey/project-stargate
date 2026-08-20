"""AI monitor.

Reviews the viewer's latest transcript entry and either stays silent or
issues one short structural prompt, within the envelope defined by
agents/monitor/prompt.txt. Blind by construction, it receives only the
transcript, never target material. Fails closed, any error results in
silence.
"""

import json
from pathlib import Path
from uuid import UUID

from agents.models import MonitorDecision
from core.config.logger import logger
from core.config.settings import settings
from core.connections import session_manager
from core.db import engine
from core.models.rv import EventKind, RVSession, RVSessionStatus
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from services import session_engine
from services.protocol import open_aol
from services.serializers import serialize_event
from sqlmodel.ext.asyncio.session import AsyncSession

# Only these kinds carry viewer language worth reviewing.
REVIEWABLE_KINDS = {
    EventKind.IDEOGRAM_A,
    EventKind.IDEOGRAM_B,
    EventKind.SENSORY,
    EventKind.DIMENSIONAL,
    EventKind.AESTHETIC_IMPACT,
    EventKind.EMOTIONAL_IMPACT,
    EventKind.TANGIBLE,
    EventKind.INTANGIBLE,
    EventKind.VIEWER_NOTE,
    EventKind.AOL,
}

TRANSCRIPT_WINDOW = 20


def _event_line(event) -> str:
    text = event.payload.get("text", "")
    if event.kind == EventKind.SKETCH:
        text = "(ink on paper)"
    stage = f"S{event.stage}" if event.stage else "--"
    return f"[{stage}] {event.kind.value}: {text}"


async def run_monitor(session_id: UUID) -> None:
    """One review pass. Appends a monitor_prompt event when the model
    decides to speak, otherwise does nothing."""
    if not settings.ai_enabled:
        return

    async with AsyncSession(engine, expire_on_commit=False) as db:
        session = await db.get(RVSession, session_id)
        if session is None or session.status != RVSessionStatus.ACTIVE:
            return
        events = await session_engine._load_events(db, session_id)

    viewer_events = [e for e in events if e.kind in REVIEWABLE_KINDS]
    if not viewer_events:
        return
    latest = viewer_events[-1]
    if latest.kind == EventKind.AOL:
        # The engine already gave the declaration patter.
        return

    from services.session_engine import _views

    aol_state = "open" if open_aol(_views(events)) else "not open"
    window = events[-TRANSCRIPT_WINDOW:]
    transcript = "\n".join(_event_line(e) for e in window)

    prompt_path = Path(__file__).parent / "prompt.txt"
    template = prompt_path.read_text(encoding="utf-8")
    prompt = template.format(
        stage=session.current_stage or "none",
        aol_state=aol_state,
        transcript=transcript,
        latest=_event_line(latest),
    )

    llm = ChatGoogleGenerativeAI(
        model=settings.LLM_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=0.2,
    )
    monitor = llm.with_structured_output(MonitorDecision)
    decision = await monitor.ainvoke([HumanMessage(content=prompt)])

    if not isinstance(decision, MonitorDecision):
        return
    if decision.action != "prompt" or not decision.text.strip():
        return

    text = decision.text.strip()
    from services.protocol import is_leading_patter

    if is_leading_patter(text):
        logger.info(f"Suppressed leading monitor prompt: {text}")
        return

    async with AsyncSession(engine, expire_on_commit=False) as db:
        event = await session_engine.append_monitor_prompt(
            db, session_id, text, source="llm"
        )
    await session_manager.broadcast_to_all(
        json.dumps({"type": "event", "event": serialize_event(event)}),
        str(session_id),
    )
