"""Auditable research packages [PAT-REPORT].

A judged or locked session can leave the building as one unedited JSON
package: cue, transcript, timestamps, judgment, FoM, and the unsealed
target with its seal hash. Active sessions cannot be exported. The
package is the software form of the unedited master log.
"""

from uuid import UUID

from core.models.rv import (
    AnalystReport,
    AuditLog,
    DisplacementScore,
    Judgment,
    RVSession,
    RVSessionStatus,
    SealedTarget,
    Series,
    Tasking,
    Viewer,
)
from services import session_engine
from services.serializers import serialize_event, serialize_session
from services.session_engine import EngineError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession


async def session_package(db: AsyncSession, session_id: UUID) -> dict:
    session = await db.get(RVSession, session_id)
    if session is None:
        raise EngineError("session_not_found", "Session not found", 404)
    if session.status == RVSessionStatus.ACTIVE:
        raise EngineError(
            "not_locked",
            "A research package opens only after the session locks.",
            403,
        )

    tasking = await db.get(Tasking, session.tasking_id)
    assert tasking is not None
    target = await db.get(SealedTarget, tasking.target_id)
    assert target is not None
    events = await session_engine._load_events(db, session_id)
    judgment = (
        await db.exec(
            select(Judgment)
            .where(Judgment.session_id == session_id)
            .order_by(col(Judgment.created_at).desc())
        )
    ).first()
    reports = list(
        (
            await db.exec(
                select(AnalystReport)
                .where(AnalystReport.session_id == session_id)
                .order_by(col(AnalystReport.created_at))
            )
        ).all()
    )
    audits = list(
        (
            await db.exec(
                select(AuditLog)
                .where(AuditLog.entity_id == str(session.id))
                .order_by(col(AuditLog.created_at))
            )
        ).all()
    )
    viewer = await db.get(Viewer, session.viewer_id) if session.viewer_id else None

    return {
        "kind": "session_package",
        "protocol": tasking.protocol.value,
        "viewer": viewer.callsign if viewer else session.viewer_name,
        "taskingNumber": tasking.tasking_number,
        "session": serialize_session(session, tasking, target),
        "events": [serialize_event(event) for event in events],
        "judgment": (
            {
                "rankOfTrueTarget": judgment.rank_of_true_target,
                "poolSize": judgment.pool_size,
                "accuracy": judgment.accuracy,
                "reliability": judgment.reliability,
                "figureOfMerit": judgment.figure_of_merit,
                "judgeName": judgment.judge_name,
                "createdAt": judgment.created_at.isoformat(),
            }
            if judgment
            else None
        ),
        "target": {
            "id": str(target.id),
            "kind": target.kind.value,
            "title": target.title,
            "payloadB64": target.payload_b64,
            "payloadSha256": target.payload_sha256,
            "coordinates": target.coordinates,
            "feedbackNotes": target.feedback_notes,
        },
        "analystReports": [
            {
                "model": report.model,
                "summary": report.summary,
                "advisoryScore": report.advisory_score,
                "createdAt": report.created_at.isoformat(),
            }
            for report in reports
        ],
        "audit": [
            {
                "action": row.action,
                "createdAt": row.created_at.isoformat(),
                "detail": row.detail,
            }
            for row in audits
        ],
    }


async def series_package(db: AsyncSession, series_id: UUID) -> dict:
    series = await db.get(Series, series_id)
    if series is None:
        raise EngineError("series_not_found", "Series not found", 404)
    taskings = list(
        (
            await db.exec(
                select(Tasking)
                .where(Tasking.series_id == series_id)
                .order_by(col(Tasking.series_position))
            )
        ).all()
    )
    trials = []
    for tasking in taskings:
        session = (
            await db.exec(select(RVSession).where(RVSession.tasking_id == tasking.id))
        ).first()
        if session is None or session.status == RVSessionStatus.ACTIVE:
            trials.append(
                {
                    "seriesPosition": tasking.series_position,
                    "taskingNumber": tasking.tasking_number,
                    "status": session.status.value if session else "sealed",
                    "package": None,
                }
            )
            continue
        package = await session_package(db, session.id)
        trials.append(
            {
                "seriesPosition": tasking.series_position,
                "taskingNumber": tasking.tasking_number,
                "status": session.status.value,
                "package": package,
            }
        )

    scores = list(
        (
            await db.exec(
                select(DisplacementScore)
                .where(DisplacementScore.series_id == series_id)
                .order_by(col(DisplacementScore.lag))
            )
        ).all()
    )
    return {
        "kind": "series_package",
        "name": series.name,
        "feedbackPolicy": series.feedback_policy.value,
        "trialCount": len(taskings),
        "trials": trials,
        "displacement": [
            {
                "lag": score.lag,
                "rank": score.rank,
                "isHit": score.is_hit,
                "poolSize": score.pool_size,
            }
            for score in scores
        ],
    }
