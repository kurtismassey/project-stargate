"""REST API.

Session control runs over REST so every state change is validated by the
engine in one place. Live ink and event fan-out run over the chamber
WebSocket (routes/websocket.py).
"""

import asyncio
import json
from uuid import UUID

from core.config.logger import logger
from core.config.settings import settings
from core.connections import session_manager
from core.db import get_session
from core.models.rv import (
    AnalystReport,
    CueType,
    EventKind,
    FeedbackPolicy,
    JudgeKind,
    Protocol,
    RVSession,
    SealedTarget,
    Series,
    SessionEnvironment,
    StageRecord,
    TargetPool,
    Tasking,
    utcnow,
)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from services import session_engine
from services.serializers import (
    serialize_event,
    serialize_pool,
    serialize_pool_member,
    serialize_series,
    serialize_session,
    serialize_tasking,
)
from services.session_engine import EngineError
from services.stats import population_stats
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter(prefix="/api")


def _raise(error: EngineError) -> None:
    raise HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": error.message},
    )


async def _broadcast(session_id: UUID, message: dict) -> None:
    await session_manager.broadcast_to_all(json.dumps(message), str(session_id))


@router.get("/health")
async def health():
    return {"status": "ok", "aiEnabled": settings.ai_enabled}


# ---------------------------------------------------------------- pools


class CreatePoolRequest(BaseModel):
    name: str
    description: str = ""


class AddTargetRequest(BaseModel):
    payload_b64: str = Field(alias="payloadB64")
    title: str = ""
    coordinates: str | None = None
    feedback_notes: str = Field(default="", alias="feedbackNotes")


@router.get("/pools")
async def list_pools(db: AsyncSession = Depends(get_session)):
    pools = (await db.exec(select(TargetPool))).all()
    result = []
    for pool in pools:
        count = (
            await db.exec(
                select(func.count())
                .select_from(SealedTarget)
                .where(SealedTarget.pool_id == pool.id)
            )
        ).one()
        result.append(serialize_pool(pool, int(count)))
    return {"pools": result}


@router.post("/pools", status_code=201)
async def create_pool(body: CreatePoolRequest, db: AsyncSession = Depends(get_session)):
    pool = TargetPool(name=body.name, description=body.description)
    db.add(pool)
    await db.commit()
    await db.refresh(pool)
    return serialize_pool(pool, 0)


@router.post("/pools/{pool_id}/targets", status_code=201)
async def add_target(
    pool_id: UUID, body: AddTargetRequest, db: AsyncSession = Depends(get_session)
):
    pool = await db.get(TargetPool, pool_id)
    if pool is None:
        raise HTTPException(404, "Pool not found")
    target = SealedTarget(
        pool_id=pool.id,
        payload_b64=body.payload_b64,
        payload_sha256=session_engine.sha256_b64(body.payload_b64),
        title=body.title,
        coordinates=body.coordinates,
        feedback_notes=body.feedback_notes,
        sealed_at=utcnow(),
    )
    db.add(target)
    await db.commit()
    # Only the seal receipt leaves the server. The payload stays sealed.
    return {"id": str(target.id), "payloadSha256": target.payload_sha256}


# ---------------------------------------------------------------- series


class CreateSeriesRequest(BaseModel):
    name: str
    pool_id: UUID | None = Field(default=None, alias="poolId")
    feedback_policy: FeedbackPolicy = Field(
        default=FeedbackPolicy.IMMEDIATE, alias="feedbackPolicy"
    )


@router.get("/series")
async def list_series(db: AsyncSession = Depends(get_session)):
    all_series = (await db.exec(select(Series))).all()
    result = []
    for series in all_series:
        count = (
            await db.exec(
                select(func.count())
                .select_from(Tasking)
                .where(Tasking.series_id == series.id)
            )
        ).one()
        result.append(serialize_series(series, int(count)))
    return {"series": result}


@router.post("/series", status_code=201)
async def create_series(
    body: CreateSeriesRequest, db: AsyncSession = Depends(get_session)
):
    pool_id = body.pool_id
    if pool_id is None:
        pool = (await db.exec(select(TargetPool).limit(1))).first()
        if pool is None:
            raise HTTPException(409, "No target pool exists")
        pool_id = pool.id
    series = Series(
        name=body.name, pool_id=pool_id, feedback_policy=body.feedback_policy
    )
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return serialize_series(series, 0)


# ---------------------------------------------------------------- taskings


class CreateTaskingRequest(BaseModel):
    pool_id: UUID | None = Field(default=None, alias="poolId")
    protocol: Protocol = Protocol.CRV
    cue_type: CueType = Field(default=CueType.TASKING_NUMBER, alias="cueType")
    environment: SessionEnvironment = SessionEnvironment.MONITORED_AI
    series_id: UUID | None = Field(default=None, alias="seriesId")


@router.get("/taskings")
async def list_taskings(db: AsyncSession = Depends(get_session)):
    taskings = (
        await db.exec(select(Tasking).order_by(col(Tasking.created_at).desc()))
    ).all()
    sessions = (await db.exec(select(RVSession))).all()
    session_by_tasking = {s.tasking_id: s for s in sessions}
    result = []
    for tasking in taskings:
        target = await db.get(SealedTarget, tasking.target_id)
        assert target is not None
        data = serialize_tasking(tasking, target)
        linked = session_by_tasking.get(tasking.id)
        data["sessionId"] = str(linked.id) if linked else None
        data["sessionStatus"] = linked.status if linked else None
        result.append(data)
    return {"taskings": result}


@router.post("/taskings", status_code=201)
async def create_tasking(
    body: CreateTaskingRequest, db: AsyncSession = Depends(get_session)
):
    try:
        tasking = await session_engine.create_tasking(
            db,
            pool_id=body.pool_id,
            protocol=body.protocol,
            cue_type=body.cue_type,
            environment=body.environment,
            series_id=body.series_id,
        )
    except EngineError as error:
        _raise(error)
    target = await db.get(SealedTarget, tasking.target_id)
    assert target is not None
    data = serialize_tasking(tasking, target)
    data["sessionId"] = None
    data["sessionStatus"] = None
    return data


# ---------------------------------------------------------------- sessions


class StartSessionRequest(BaseModel):
    tasking_id: UUID = Field(alias="taskingId")
    viewer_name: str = Field(default="Viewer 001", alias="viewerName")


class AppendEventRequest(BaseModel):
    kind: EventKind
    payload: dict = Field(default_factory=dict)


async def _session_bundle(db: AsyncSession, session: RVSession) -> dict:
    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    target = await db.get(SealedTarget, tasking.target_id)
    assert target is not None
    return serialize_session(session, tasking, target)


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_session)):
    sessions = (
        await db.exec(select(RVSession).order_by(col(RVSession.started_at).desc()))
    ).all()
    return {"sessions": [await _session_bundle(db, s) for s in sessions]}


@router.post("/sessions", status_code=201)
async def start_session(
    body: StartSessionRequest, db: AsyncSession = Depends(get_session)
):
    try:
        session = await session_engine.start_session(
            db, body.tasking_id, body.viewer_name
        )
    except EngineError as error:
        _raise(error)
    return await _session_bundle(db, session)


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: UUID, db: AsyncSession = Depends(get_session)):
    session = await db.get(RVSession, session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    bundle = await _session_bundle(db, session)
    events = await session_engine._load_events(db, session_id)
    bundle["events"] = [serialize_event(e) for e in events]
    records = (
        await db.exec(
            select(StageRecord)
            .where(StageRecord.session_id == session_id)
            .order_by(col(StageRecord.entered_at))
        )
    ).all()
    bundle["stageRecords"] = [
        {
            "stage": r.stage,
            "enteredAt": r.entered_at.isoformat(),
            "exitedAt": r.exited_at.isoformat() if r.exited_at else None,
            "dwellMs": r.dwell_ms,
        }
        for r in records
    ]
    return bundle


@router.post("/sessions/{session_id}/events", status_code=201)
async def append_event(
    session_id: UUID,
    body: AppendEventRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        result = await session_engine.append_event(
            db, session_id, body.kind, body.payload
        )
    except EngineError as error:
        _raise(error)

    serialized = serialize_event(result.event)
    monitor_events = [serialize_event(e) for e in result.monitor_events]
    for event_data in [serialized, *monitor_events]:
        await _broadcast(session_id, {"type": "event", "event": event_data})

    _schedule_ai_monitor(session_id, body.kind)
    return {"event": serialized, "monitorEvents": monitor_events}


@router.post("/sessions/{session_id}/advance")
async def advance_stage(session_id: UUID, db: AsyncSession = Depends(get_session)):
    try:
        session = await session_engine.advance_stage(db, session_id)
    except EngineError as error:
        _raise(error)
    bundle = await _session_bundle(db, session)
    await _broadcast(session_id, {"type": "session", "session": bundle})
    return bundle


@router.post("/sessions/{session_id}/lock")
async def lock_session(session_id: UUID, db: AsyncSession = Depends(get_session)):
    try:
        session = await session_engine.lock_session(db, session_id)
    except EngineError as error:
        _raise(error)
    bundle = await _session_bundle(db, session)
    await _broadcast(session_id, {"type": "session", "session": bundle})
    return bundle


@router.get("/sessions/{session_id}/feedback")
async def get_feedback(session_id: UUID, db: AsyncSession = Depends(get_session)):
    try:
        return await session_engine.get_feedback(db, session_id)
    except EngineError as error:
        _raise(error)


# ---------------------------------------------------------------- judging


class JudgmentRequest(BaseModel):
    rankings: list[dict]
    judge_name: str = Field(default="", alias="judgeName")
    notes: str = ""


class DisplacementRequest(BaseModel):
    lag: int
    rank: int
    pool_size: int = Field(alias="poolSize")
    judgment_id: UUID | None = Field(default=None, alias="judgmentId")


@router.get("/sessions/{session_id}/judging-pool")
async def get_judging_pool(session_id: UUID, db: AsyncSession = Depends(get_session)):
    try:
        members = await session_engine.judging_pool(db, session_id)
    except EngineError as error:
        _raise(error)
    return {"pool": [serialize_pool_member(m) for m in members]}


@router.post("/sessions/{session_id}/judgments", status_code=201)
async def record_judgment(
    session_id: UUID,
    body: JudgmentRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        judgment = await session_engine.record_judgment(
            db,
            session_id,
            body.rankings,
            judge_kind=JudgeKind.HUMAN,
            judge_name=body.judge_name,
            notes=body.notes,
        )
    except EngineError as error:
        _raise(error)
    return {
        "id": str(judgment.id),
        "rankOfTrueTarget": judgment.rank_of_true_target,
        "poolSize": judgment.pool_size,
    }


@router.post("/sessions/{session_id}/displacement", status_code=201)
async def record_displacement(
    session_id: UUID,
    body: DisplacementRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        score = await session_engine.record_displacement(
            db,
            session_id,
            lag=body.lag,
            rank=body.rank,
            pool_size=body.pool_size,
            judgment_id=body.judgment_id,
        )
    except EngineError as error:
        _raise(error)
    return {
        "id": str(score.id),
        "lag": score.lag,
        "rank": score.rank,
        "isHit": score.is_hit,
    }


# ---------------------------------------------------------------- analysis


@router.get("/sessions/{session_id}/analysis")
async def list_analysis(session_id: UUID, db: AsyncSession = Depends(get_session)):
    reports = (
        await db.exec(
            select(AnalystReport)
            .where(AnalystReport.session_id == session_id)
            .order_by(col(AnalystReport.created_at).desc())
        )
    ).all()
    return {
        "reports": [
            {
                "id": str(r.id),
                "model": r.model,
                "summary": r.summary,
                "correspondences": r.correspondences,
                "advisoryScore": r.advisory_score,
                "createdAt": r.created_at.isoformat(),
            }
            for r in reports
        ]
    }


@router.post("/sessions/{session_id}/analysis", status_code=201)
async def run_analysis(session_id: UUID, db: AsyncSession = Depends(get_session)):
    """Advisory LLM read of a locked session against the sealed target.
    Never the official score [UTTS-1995]."""
    if not settings.ai_enabled:
        raise HTTPException(
            503,
            detail={
                "code": "ai_disabled",
                "message": "Analyst unavailable, GOOGLE_API_KEY is not set.",
            },
        )
    from agents import run_analyst

    try:
        report = await run_analyst(db, session_id)
    except EngineError as error:
        _raise(error)
    return {
        "id": str(report.id),
        "model": report.model,
        "summary": report.summary,
        "correspondences": report.correspondences,
        "advisoryScore": report.advisory_score,
        "createdAt": report.created_at.isoformat(),
    }


# ---------------------------------------------------------------- stats


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_session)):
    return await population_stats(db)


# ------------------------------------------------------- AI monitor hook


def _schedule_ai_monitor(session_id: UUID, kind: EventKind) -> None:
    """Fire-and-forget LLM monitor review of the latest viewer entry.
    Fails closed, an AI error never touches the session loop."""
    if not settings.ai_enabled:
        return
    if kind in (EventKind.SKETCH, EventKind.AOL_BREAK, EventKind.BREAK):
        return

    async def _run() -> None:
        try:
            from agents import run_monitor

            await run_monitor(session_id)
        except Exception as error:
            logger.error(f"AI monitor failed closed for {session_id}: {error}")

    asyncio.create_task(_run())
