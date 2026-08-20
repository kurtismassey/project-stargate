"""Post-lock analyst.

Compares a locked session's transcript and sketches against the sealed
target and stores an advisory AnalystReport. Refuses unlocked sessions,
so target material cannot leak through this path [PAT-REPORT]. The
generated "target model" concept from the prototype is gone, accuracy is
judged only against the sealed target [product spec F8].
"""

from pathlib import Path
from uuid import UUID

from agents.models import AnalystAssessment
from core.config.settings import settings
from core.models.rv import (
    AnalystReport,
    EventKind,
    RVSession,
    RVSessionStatus,
    SealedTarget,
    Tasking,
)
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from services import session_engine
from services.session_engine import EngineError
from sqlmodel.ext.asyncio.session import AsyncSession

TEXT_KINDS = {
    EventKind.IDEOGRAM_A,
    EventKind.IDEOGRAM_B,
    EventKind.SENSORY,
    EventKind.DIMENSIONAL,
    EventKind.AESTHETIC_IMPACT,
    EventKind.EMOTIONAL_IMPACT,
    EventKind.TANGIBLE,
    EventKind.INTANGIBLE,
    EventKind.AOL,
    EventKind.AOL_SIGNAL,
    EventKind.VIEWER_NOTE,
}


async def run_analyst(db: AsyncSession, session_id: UUID) -> AnalystReport:
    session = await db.get(RVSession, session_id)
    if session is None:
        raise EngineError("session_not_found", "Session not found", 404)
    if session.status == RVSessionStatus.ACTIVE:
        raise EngineError(
            "not_locked", "Analysis is sealed until the session locks.", 403
        )

    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    target = await db.get(SealedTarget, tasking.target_id)
    assert target is not None

    events = await session_engine._load_events(db, session_id)
    lines = []
    sketch_images: list[str] = []
    for event in events:
        if event.kind in TEXT_KINDS:
            stage = f"S{event.stage}" if event.stage else "--"
            lines.append(
                f"[{stage}] {event.kind.value}: {event.payload.get('text', '')}"
            )
        elif event.kind == EventKind.SKETCH:
            image = event.payload.get("imageB64")
            if image:
                sketch_images.append(image)
        elif event.kind == EventKind.IDEOGRAM:
            image = event.payload.get("imageB64")
            if image:
                sketch_images.append(image)

    prompt_path = Path(__file__).parent / "prompt.txt"
    template = prompt_path.read_text(encoding="utf-8")
    prompt = template.format(transcript="\n".join(lines) or "(no verbal data)")

    content: list[dict] = [{"type": "text", "text": prompt}]
    for image in sketch_images[:8]:
        if not image.startswith("data:image"):
            image = f"data:image/png;base64,{image}"
        content.append({"type": "image_url", "image_url": {"url": image}})
    if target.payload_b64:
        target_url = target.payload_b64
        if not target_url.startswith("data:image"):
            target_url = f"data:image/jpeg;base64,{target_url}"
        content.append({"type": "image_url", "image_url": {"url": target_url}})

    llm = ChatGoogleGenerativeAI(
        model=settings.LLM_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=0.1,
    )
    analyst = llm.with_structured_output(AnalystAssessment)
    assessment = await analyst.ainvoke([HumanMessage(content=content)])  # type: ignore[arg-type]

    if not isinstance(assessment, AnalystAssessment):
        raise EngineError("bad_analysis", "Analyst returned no assessment", 502)

    report = AnalystReport(
        session_id=session.id,
        model=settings.LLM_MODEL,
        summary=assessment.summary,
        correspondences=[c.model_dump() for c in assessment.correspondences],
        advisory_score=assessment.advisory_score,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
