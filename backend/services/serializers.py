"""Viewer-safe serialization.

Everything that leaves the server toward a viewer or live monitor passes
through these functions. Target material (payload, title, notes, and the
coordinates behind a tasking-number cue) is only ever serialized by the
feedback and judging paths, which require a locked session. This is the
blindness invariant [PAT-REPORT], proven in tests/test_blindness.py.
"""

from core.models.rv import (
    CueType,
    Operator,
    RVSession,
    RVSessionStatus,
    SealedTarget,
    Series,
    TargetKind,
    TargetPool,
    Tasking,
    TranscriptEvent,
)
from services.session_engine import cue_text


def serialize_tasking(tasking: Tasking, target: SealedTarget) -> dict:
    """The blind face of a tasking. Carries the cue, never the target."""
    return {
        "id": str(tasking.id),
        "taskingNumber": tasking.tasking_number,
        "cue": cue_text(tasking, target),
        "cueType": tasking.cue_type,
        "protocol": tasking.protocol,
        "environment": tasking.environment,
        "seriesId": str(tasking.series_id) if tasking.series_id else None,
        "seriesPosition": tasking.series_position,
        "arvPairId": str(tasking.arv_pair_id) if tasking.arv_pair_id else None,
        "createdAt": tasking.created_at.isoformat(),
        "sealedAt": tasking.sealed_at.isoformat(),
    }


def serialize_session(
    session: RVSession, tasking: Tasking, target: SealedTarget
) -> dict:
    return {
        "id": str(session.id),
        "status": session.status,
        "currentStage": session.current_stage,
        "viewerId": str(session.viewer_id) if session.viewer_id else None,
        "viewerName": session.viewer_name,
        "operatorId": str(session.operator_id) if session.operator_id else None,
        "operatorName": session.operator_name or None,
        "monitorId": str(session.monitor_id) if session.monitor_id else None,
        "monitorName": session.monitor_name or None,
        "monitorMode": session.monitor_mode,
        "monitorBlind": session.monitor_blind,
        "startedAt": session.started_at.isoformat(),
        "lockedAt": session.locked_at.isoformat() if session.locked_at else None,
        "feedbackAt": session.feedback_at.isoformat() if session.feedback_at else None,
        "feedbackLatencyMs": session.feedback_latency_ms,
        "aolCount": session.aol_count,
        "breakCount": session.break_count,
        "leadingFlagCount": session.leading_flag_count,
        "source": session.source,
        "tasking": serialize_tasking(tasking, target),
    }


def serialize_operator(
    operator: Operator,
    *,
    sessions_operated: int = 0,
    sessions_monitored: int = 0,
) -> dict:
    """Public staff record. The hash never leaves."""
    return {
        "id": str(operator.id),
        "callsign": operator.callsign,
        "notes": operator.notes,
        "locked": bool(operator.passphrase_hash),
        "createdAt": operator.created_at.isoformat(),
        "sessionsOperated": sessions_operated,
        "sessionsMonitored": sessions_monitored,
    }


def serialize_event(event: TranscriptEvent) -> dict:
    return {
        "id": str(event.id),
        "sessionId": str(event.session_id),
        "seq": event.seq,
        "stage": event.stage,
        "kind": event.kind,
        "payload": event.payload,
        "flaggedLeading": event.flagged_leading,
        "createdAt": event.created_at.isoformat(),
        "msSinceStart": event.ms_since_start,
    }


def serialize_pool(pool: TargetPool, target_count: int) -> dict:
    return {
        "id": str(pool.id),
        "name": pool.name,
        "description": pool.description,
        "targetCount": target_count,
        "createdAt": pool.created_at.isoformat(),
    }


def serialize_series(series: Series, tasking_count: int) -> dict:
    return {
        "id": str(series.id),
        "name": series.name,
        "poolId": str(series.pool_id),
        "feedbackPolicy": series.feedback_policy,
        "taskingCount": tasking_count,
        "createdAt": series.created_at.isoformat(),
    }


def serialize_pool_member(target: SealedTarget) -> dict:
    """A judging-pool member. Reveals imagery (judging happens after lock)
    but never marks which member is the true target."""
    return {
        "id": str(target.id),
        "kind": target.kind,
        "payloadB64": target.payload_b64,
        "coordinates": target.coordinates if target.kind != TargetKind.IMAGE else None,
    }


def session_is_locked(session: RVSession) -> bool:
    return session.status != RVSessionStatus.ACTIVE


__all__ = [
    "serialize_tasking",
    "serialize_session",
    "serialize_event",
    "serialize_pool",
    "serialize_series",
    "serialize_pool_member",
    "serialize_operator",
    "session_is_locked",
    "CueType",
]
