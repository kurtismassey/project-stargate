"""Session engine.

Owns the protocol lifecycle. Every state change flows through here so the
blindness invariant, stage order, and the audit trail hold no matter which
transport (REST or WebSocket) asked for the change.
"""

import hashlib
import random
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from core.config.logger import logger
from core.models.rv import (
    AuditLog,
    CueType,
    DisplacementScore,
    EventKind,
    JudgeKind,
    Judgment,
    Protocol,
    RVSession,
    RVSessionStatus,
    SealedTarget,
    Series,
    SessionEnvironment,
    StageRecord,
    TargetPool,
    Tasking,
    TranscriptEvent,
    utcnow,
)
from services import protocol as protocol_rules
from services.protocol import EventView, Refusal
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

DISPLACEMENT_LAGS = (-2, -1, 1, 2)

DEFAULT_POOL_NAME = "Reference Picture Pool"

STAGE_PATTER = {
    1: "Stage I. Take the cue. Let the ideogram come, then decode A and B.",
    2: "Stage II. Sensory contact. Colors, textures, temperatures, sounds, "
    "smells. Single words. Stay low level.",
    3: "Stage III. Dimension and motion. Objectify sizes, verticals, mass. "
    "Sketch what presents itself.",
    4: "Stage IV. Work the matrix. Sweep the columns as data emerges.",
    5: "Stage V. Interrogate your own data. Emanations from objects, "
    "attributes, subjects. Nothing outside your paper.",
    6: "Stage VI. Direct involvement. Render the site.",
}


class EngineError(Exception):
    """Raised for lifecycle violations (wrong status, missing rows)."""

    def __init__(self, code: str, message: str, status_code: int = 409):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class AppendResult:
    event: TranscriptEvent
    monitor_events: list[TranscriptEvent]


def sha256_b64(payload_b64: str) -> str:
    return hashlib.sha256(payload_b64.encode("utf-8")).hexdigest()


async def seed_default_pool(db: AsyncSession) -> None:
    """Create the reference picture pool from bundled targets when the
    database has no pools yet. Payloads stay server-side (blindness)."""
    existing = (await db.exec(select(TargetPool).limit(1))).first()
    if existing:
        return

    targets_dir = Path(__file__).parent.parent / "targets"
    image_files = sorted(
        f
        for f in targets_dir.iterdir()
        if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if not image_files:
        logger.info("No bundled target images found, skipping pool seed")
        return

    pool = TargetPool(
        name=DEFAULT_POOL_NAME,
        description="Bundled reference imagery for picture remote viewing.",
    )
    db.add(pool)
    await db.flush()

    from agents.target.tool import compress_image

    now = utcnow()
    for path in image_files:
        payload = compress_image(path.read_bytes(), 800, 600, 85)
        title = path.stem.replace("-", " ").replace("_", " ").title()
        db.add(
            SealedTarget(
                pool_id=pool.id,
                payload_b64=payload,
                payload_sha256=sha256_b64(payload),
                title=title,
                source="bundled",
                sealed_at=now,
            )
        )
    db.add(
        AuditLog(
            action="pool_seeded",
            entity_type="target_pool",
            entity_id=str(pool.id),
            detail={"targets": len(image_files)},
        )
    )
    await db.commit()
    logger.info(f"Seeded default pool with {len(image_files)} sealed targets")


async def create_tasking(
    db: AsyncSession,
    pool_id: UUID | None = None,
    protocol: Protocol = Protocol.CRV,
    cue_type: CueType = CueType.TASKING_NUMBER,
    environment: SessionEnvironment = SessionEnvironment.MONITORED_AI,
    series_id: UUID | None = None,
) -> Tasking:
    """Seal a random target from the pool into a new tasking.

    The server picks the target so no operator in the loop knows which
    pool member was sealed [PAT-REPORT double-blind practice].
    """
    series: Series | None = None
    if series_id is not None:
        series = await db.get(Series, series_id)
        if series is None:
            raise EngineError("series_not_found", "Series not found", 404)
        pool_id = series.pool_id

    if pool_id is None:
        pool = (
            await db.exec(
                select(TargetPool).where(TargetPool.name == DEFAULT_POOL_NAME)
            )
        ).first()
        if pool is None:
            pool = (await db.exec(select(TargetPool).limit(1))).first()
        if pool is None:
            raise EngineError("no_pool", "No target pool exists", 409)
        pool_id = pool.id

    targets = (
        await db.exec(select(SealedTarget).where(SealedTarget.pool_id == pool_id))
    ).all()
    if not targets:
        raise EngineError("empty_pool", "Target pool has no sealed targets", 409)
    target = random.choice(list(targets))

    if cue_type == CueType.COORDINATES and not target.coordinates:
        cue_type = CueType.TASKING_NUMBER

    series_position: int | None = None
    if series is not None:
        count = (
            await db.exec(
                select(func.count())
                .select_from(Tasking)
                .where(Tasking.series_id == series.id)
            )
        ).one()
        series_position = int(count) + 1

    tasking = Tasking(
        target_id=target.id,
        cue_type=cue_type,
        protocol=protocol,
        environment=environment,
        series_id=series.id if series else None,
        series_position=series_position,
    )
    db.add(tasking)
    await db.flush()
    db.add(
        AuditLog(
            action="tasking_sealed",
            entity_type="tasking",
            entity_id=str(tasking.id),
            detail={
                "tasking_number": tasking.tasking_number,
                "protocol": protocol.value,
                "cue_type": cue_type.value,
            },
        )
    )
    await db.commit()
    await db.refresh(tasking)
    return tasking


def cue_text(tasking: Tasking, target: SealedTarget) -> str:
    if tasking.cue_type == CueType.COORDINATES and target.coordinates:
        return target.coordinates
    return tasking.tasking_number


async def start_session(
    db: AsyncSession, tasking_id: UUID, viewer_name: str = "Viewer 001"
) -> RVSession:
    tasking = await db.get(Tasking, tasking_id)
    if tasking is None:
        raise EngineError("tasking_not_found", "Tasking not found", 404)

    existing = (
        await db.exec(select(RVSession).where(RVSession.tasking_id == tasking_id))
    ).first()
    if existing is not None:
        raise EngineError("tasking_in_use", "This tasking already has a session", 409)

    target = await db.get(SealedTarget, tasking.target_id)
    if target is None:
        raise EngineError("target_not_found", "Sealed target missing", 500)

    is_crv = tasking.protocol == Protocol.CRV
    session = RVSession(
        tasking_id=tasking.id,
        viewer_name=viewer_name,
        monitor_mode=tasking.environment,
        monitor_blind=True,
    )
    # Assigned after construction so SQLAlchemy instrumentation records the
    # set event. Passing None through __init__ lets the column default win.
    session.current_stage = 1 if is_crv else None
    db.add(session)
    await db.flush()

    now = utcnow()
    db.add(
        TranscriptEvent(
            session_id=session.id,
            seq=1,
            stage=session.current_stage,
            kind=EventKind.CUE,
            payload={"cue": cue_text(tasking, target), "cue_type": tasking.cue_type},
            created_at=now,
            ms_since_start=0,
        )
    )
    monitor_seq = 2
    if tasking.environment != SessionEnvironment.SOLO:
        opening = (
            STAGE_PATTER[1]
            if is_crv
            else "Settle in. Speak what arrives. I will keep the record."
        )
        db.add(
            TranscriptEvent(
                session_id=session.id,
                seq=monitor_seq,
                stage=session.current_stage,
                kind=EventKind.MONITOR_PROMPT,
                payload={"text": opening, "source": "engine"},
                created_at=now,
                ms_since_start=0,
            )
        )
    if is_crv:
        db.add(StageRecord(session_id=session.id, stage=1, entered_at=now))
    db.add(
        AuditLog(
            action="session_started",
            entity_type="rv_session",
            entity_id=str(session.id),
            detail={"tasking_number": tasking.tasking_number},
        )
    )
    await db.commit()
    await db.refresh(session)
    return session


async def _load_session(db: AsyncSession, session_id: UUID) -> RVSession:
    session = await db.get(RVSession, session_id)
    if session is None:
        raise EngineError("session_not_found", "Session not found", 404)
    return session


async def _load_events(db: AsyncSession, session_id: UUID) -> list[TranscriptEvent]:
    statement = (
        select(TranscriptEvent)
        .where(TranscriptEvent.session_id == session_id)
        .order_by(col(TranscriptEvent.seq))
    )
    return list((await db.exec(statement)).all())


def _views(events: list[TranscriptEvent]) -> list[EventView]:
    return [EventView(kind=e.kind, stage=e.stage) for e in events]


VIEWER_EVENT_KINDS = protocol_rules.SIGNAL_KINDS | {
    EventKind.AOL,
    EventKind.AOL_BREAK,
    EventKind.BREAK,
    EventKind.VIEWER_NOTE,
}


async def append_event(
    db: AsyncSession,
    session_id: UUID,
    kind: EventKind,
    payload: dict,
) -> AppendResult:
    """Validate and record a viewer event, plus any deterministic monitor
    patter it triggers. Raises EngineError on refusal, with the structure
    message a monitor would give."""
    session = await _load_session(db, session_id)
    if session.status != RVSessionStatus.ACTIVE:
        raise EngineError(
            "session_not_active",
            "Session is locked. The transcript is closed.",
        )
    if kind not in VIEWER_EVENT_KINDS:
        raise EngineError(
            "not_viewer_event", f"{kind.value} is not a viewer event", 422
        )

    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    events = await _load_events(db, session_id)

    refusal: Refusal | None = protocol_rules.validate_event(
        tasking.protocol, session.current_stage, kind, _views(events)
    )
    if refusal is not None:
        raise EngineError(refusal.code, refusal.message, 422)

    now = utcnow()
    seq = len(events) + 1
    event = TranscriptEvent(
        session_id=session.id,
        seq=seq,
        stage=session.current_stage,
        kind=kind,
        payload=payload,
        created_at=now,
        ms_since_start=_ms_since(session, now),
    )
    db.add(event)

    monitor_events: list[TranscriptEvent] = []
    if kind == EventKind.AOL:
        session.aol_count += 1
        patter = "Declared. Objectify the break, set it aside, resume."
    elif kind == EventKind.BREAK:
        session.break_count += 1
        patter = "Break noted. Take the time you need, then re-take the cue."
    elif kind == EventKind.AOL_BREAK:
        patter = "Good. Back to the signal line when ready."
    else:
        patter = ""

    if patter and session.monitor_mode != SessionEnvironment.SOLO:
        monitor_event = TranscriptEvent(
            session_id=session.id,
            seq=seq + 1,
            stage=session.current_stage,
            kind=EventKind.MONITOR_PROMPT,
            payload={"text": patter, "source": "engine"},
            created_at=now,
            ms_since_start=_ms_since(session, now),
        )
        db.add(monitor_event)
        monitor_events.append(monitor_event)

    db.add(session)
    await db.commit()
    await db.refresh(event)
    for monitor_event in monitor_events:
        await db.refresh(monitor_event)
    return AppendResult(event=event, monitor_events=monitor_events)


async def append_monitor_prompt(
    db: AsyncSession,
    session_id: UUID,
    text: str,
    source: str = "llm",
    flagged_leading: bool = False,
) -> TranscriptEvent:
    session = await _load_session(db, session_id)
    if session.status != RVSessionStatus.ACTIVE:
        raise EngineError("session_not_active", "Session is locked.")
    events = await _load_events(db, session_id)
    now = utcnow()
    event = TranscriptEvent(
        session_id=session.id,
        seq=len(events) + 1,
        stage=session.current_stage,
        kind=EventKind.MONITOR_PROMPT,
        payload={"text": text, "source": source},
        flagged_leading=flagged_leading,
        created_at=now,
        ms_since_start=_ms_since(session, now),
    )
    if flagged_leading:
        session.leading_flag_count += 1
        db.add(session)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def advance_stage(db: AsyncSession, session_id: UUID) -> RVSession:
    session = await _load_session(db, session_id)
    if session.status != RVSessionStatus.ACTIVE:
        raise EngineError("session_not_active", "Session is locked.")
    if session.current_stage is None:
        raise EngineError("no_stages", "This protocol does not run stages", 422)

    events = await _load_events(db, session_id)
    refusal = protocol_rules.can_advance_stage(session.current_stage, _views(events))
    if refusal is not None:
        raise EngineError(refusal.code, refusal.message, 422)

    now = utcnow()
    open_record = (
        await db.exec(
            select(StageRecord)
            .where(StageRecord.session_id == session_id)
            .where(StageRecord.stage == session.current_stage)
            .where(col(StageRecord.exited_at).is_(None))
        )
    ).first()
    if open_record is not None:
        open_record.exited_at = now
        open_record.dwell_ms = _ms_between(open_record.entered_at, now)
        db.add(open_record)

    next_stage = session.current_stage + 1
    session.current_stage = next_stage
    db.add(session)
    db.add(StageRecord(session_id=session.id, stage=next_stage, entered_at=now))
    db.add(
        TranscriptEvent(
            session_id=session.id,
            seq=len(events) + 1,
            stage=next_stage,
            kind=EventKind.STAGE_ADVANCE,
            payload={"from": next_stage - 1, "to": next_stage},
            created_at=now,
            ms_since_start=_ms_since(session, now),
        )
    )
    if session.monitor_mode != SessionEnvironment.SOLO:
        db.add(
            TranscriptEvent(
                session_id=session.id,
                seq=len(events) + 2,
                stage=next_stage,
                kind=EventKind.MONITOR_PROMPT,
                payload={"text": STAGE_PATTER[next_stage], "source": "engine"},
                created_at=now,
                ms_since_start=_ms_since(session, now),
            )
        )
    await db.commit()
    await db.refresh(session)
    return session


async def lock_session(db: AsyncSession, session_id: UUID) -> RVSession:
    """Irreversible. Closes the transcript and opens feedback and judging."""
    session = await _load_session(db, session_id)
    if session.status != RVSessionStatus.ACTIVE:
        raise EngineError("session_not_active", "Session is already locked.")

    events = await _load_events(db, session_id)
    now = utcnow()
    session.status = RVSessionStatus.LOCKED
    session.locked_at = now

    open_records = (
        await db.exec(
            select(StageRecord)
            .where(StageRecord.session_id == session_id)
            .where(col(StageRecord.exited_at).is_(None))
        )
    ).all()
    for record in open_records:
        record.exited_at = now
        record.dwell_ms = _ms_between(record.entered_at, now)
        db.add(record)

    db.add(session)
    db.add(
        TranscriptEvent(
            session_id=session.id,
            seq=len(events) + 1,
            stage=session.current_stage,
            kind=EventKind.LOCK,
            payload={},
            created_at=now,
            ms_since_start=_ms_since(session, now),
        )
    )
    db.add(
        AuditLog(
            action="session_locked",
            entity_type="rv_session",
            entity_id=str(session.id),
        )
    )
    await db.commit()
    await db.refresh(session)
    return session


async def get_feedback(db: AsyncSession, session_id: UUID) -> dict:
    """Unseal the target. Only after lock. First call stamps feedback
    latency [TART-TTI]."""
    session = await _load_session(db, session_id)
    if session.status == RVSessionStatus.ACTIVE:
        raise EngineError(
            "not_locked", "Feedback is sealed until the session locks.", 403
        )
    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    target = await db.get(SealedTarget, tasking.target_id)
    assert target is not None

    if session.feedback_at is None:
        now = utcnow()
        session.feedback_at = now
        if session.locked_at is not None:
            session.feedback_latency_ms = _ms_between(session.locked_at, now)
        db.add(session)
        events = await _load_events(db, session_id)
        db.add(
            TranscriptEvent(
                session_id=session.id,
                seq=len(events) + 1,
                stage=session.current_stage,
                kind=EventKind.FEEDBACK_VIEW,
                payload={"target_sha256": target.payload_sha256},
                created_at=now,
                ms_since_start=_ms_since(session, now),
            )
        )
        db.add(
            AuditLog(
                action="target_unsealed",
                entity_type="sealed_target",
                entity_id=str(target.id),
                detail={"session_id": str(session.id)},
            )
        )
        await db.commit()
        await db.refresh(session)

    return {
        "target": {
            "id": str(target.id),
            "kind": target.kind,
            "title": target.title,
            "payloadB64": target.payload_b64,
            "payloadSha256": target.payload_sha256,
            "coordinates": target.coordinates,
            "feedbackNotes": target.feedback_notes,
        },
        "feedbackAt": session.feedback_at.isoformat(),
        "feedbackLatencyMs": session.feedback_latency_ms,
    }


async def judging_pool(
    db: AsyncSession, session_id: UUID, pool_size: int = 5
) -> list[SealedTarget]:
    """The true target plus decoys from the same pool, shuffled. Only
    after lock. The response does not mark which member is true."""
    session = await _load_session(db, session_id)
    if session.status == RVSessionStatus.ACTIVE:
        raise EngineError("not_locked", "Judging opens after the session locks.", 403)
    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    target = await db.get(SealedTarget, tasking.target_id)
    assert target is not None

    decoys = (
        await db.exec(
            select(SealedTarget)
            .where(SealedTarget.pool_id == target.pool_id)
            .where(SealedTarget.id != target.id)
        )
    ).all()
    decoys = list(decoys)
    random.shuffle(decoys)
    members = [target] + decoys[: max(0, pool_size - 1)]
    random.shuffle(members)
    return members


async def record_judgment(
    db: AsyncSession,
    session_id: UUID,
    rankings: list[dict],
    judge_kind: JudgeKind = JudgeKind.HUMAN,
    judge_name: str = "",
    notes: str = "",
) -> Judgment:
    """Persist a rank-order judgment. rankings is a list of
    {"targetId": ..., "rank": ...} covering the presented pool."""
    session = await _load_session(db, session_id)
    if session.status == RVSessionStatus.ACTIVE:
        raise EngineError("not_locked", "Judging opens after the session locks.", 403)
    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None

    ranks = {UUID(r["targetId"]): int(r["rank"]) for r in rankings}
    if tasking.target_id not in ranks:
        raise EngineError(
            "true_target_missing", "Rankings must cover the presented pool", 422
        )
    rank_values = sorted(ranks.values())
    if rank_values != list(range(1, len(rank_values) + 1)):
        raise EngineError(
            "bad_ranks", "Ranks must be a permutation of 1..pool size", 422
        )

    judgment = Judgment(
        session_id=session.id,
        judge_kind=judge_kind,
        judge_name=judge_name,
        pool_target_ids=[str(t) for t in ranks],
        rankings=[{"targetId": str(t), "rank": r} for t, r in ranks.items()],
        rank_of_true_target=ranks[tasking.target_id],
        pool_size=len(ranks),
        notes=notes,
    )
    db.add(judgment)
    session.status = RVSessionStatus.JUDGED
    db.add(session)
    db.add(
        AuditLog(
            action="session_judged",
            entity_type="rv_session",
            entity_id=str(session.id),
            detail={
                "rank_of_true_target": judgment.rank_of_true_target,
                "pool_size": judgment.pool_size,
            },
        )
    )
    await db.commit()
    await db.refresh(judgment)
    return judgment


async def record_displacement(
    db: AsyncSession,
    session_id: UUID,
    lag: int,
    rank: int,
    pool_size: int,
    judgment_id: UUID | None = None,
) -> DisplacementScore:
    """Record how the session transcript ranked against the target of
    trial n+lag in its series [TART-TTI]."""
    if lag not in DISPLACEMENT_LAGS:
        raise EngineError("bad_lag", f"Lag must be one of {DISPLACEMENT_LAGS}", 422)

    session = await _load_session(db, session_id)
    if session.status == RVSessionStatus.ACTIVE:
        raise EngineError("not_locked", "Displacement scoring opens after lock.", 403)
    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    if tasking.series_id is None or tasking.series_position is None:
        raise EngineError(
            "not_in_series", "Session's tasking is not part of a series", 422
        )

    lag_tasking = (
        await db.exec(
            select(Tasking)
            .where(Tasking.series_id == tasking.series_id)
            .where(Tasking.series_position == tasking.series_position + lag)
        )
    ).first()
    if lag_tasking is None:
        raise EngineError(
            "no_lag_trial",
            f"No trial exists at series position {tasking.series_position + lag}",
            422,
        )

    score = DisplacementScore(
        session_id=session.id,
        series_id=tasking.series_id,
        lag=lag,
        lag_target_id=lag_tasking.target_id,
        rank=rank,
        pool_size=pool_size,
        is_hit=rank == 1,
        judgment_id=judgment_id,
    )
    db.add(score)
    await db.commit()
    await db.refresh(score)
    return score


def _ms_since(session: RVSession, now) -> int:
    return _ms_between(session.started_at, now)


def _ms_between(start, then) -> int:
    return max(0, int((then - start).total_seconds() * 1000))
