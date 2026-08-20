"""Population statistics.

Chance baselines follow rank-order judging, first place with probability
1/pool_size under the null [UTTS-1995]. Displacement follows [TART-TTI].
Figure of merit is Accuracy × Reliability [MAY-FOM].
"""

from collections import defaultdict
from uuid import UUID

from core.models.rv import (
    DisplacementScore,
    Judgment,
    RVSession,
    RVSessionStatus,
    Tasking,
    Viewer,
)
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession


def _fom_block(judgments: list[Judgment]) -> dict:
    first_place = sum(1 for j in judgments if j.rank_of_true_target == 1)
    expected_first = sum(1 / j.pool_size for j in judgments)
    mean_rank = (
        sum(j.rank_of_true_target for j in judgments) / len(judgments)
        if judgments
        else None
    )
    mean_fom = (
        sum(j.figure_of_merit for j in judgments) / len(judgments)
        if judgments
        else None
    )
    mean_accuracy = (
        sum(j.accuracy for j in judgments) / len(judgments) if judgments else None
    )
    mean_reliability = (
        sum(j.reliability for j in judgments) / len(judgments) if judgments else None
    )
    return {
        "judgedSessions": len(judgments),
        "firstPlaceMatches": first_place,
        "expectedFirstPlace": round(expected_first, 2),
        "meanRankOfTrueTarget": round(mean_rank, 2) if mean_rank is not None else None,
        "meanAccuracy": round(mean_accuracy, 3) if mean_accuracy is not None else None,
        "meanReliability": (
            round(mean_reliability, 3) if mean_reliability is not None else None
        ),
        "meanFigureOfMerit": round(mean_fom, 3) if mean_fom is not None else None,
    }


async def population_stats(db: AsyncSession) -> dict:
    sessions = list((await db.exec(select(RVSession))).all())
    judgments = list((await db.exec(select(Judgment))).all())
    displacement = list((await db.exec(select(DisplacementScore))).all())
    taskings = {t.id: t for t in (await db.exec(select(Tasking))).all()}
    viewers = {v.id: v for v in (await db.exec(select(Viewer))).all()}

    by_status: dict[str, int] = {}
    for session in sessions:
        by_status[session.status.value] = by_status.get(session.status.value, 0) + 1

    total_aol = sum(s.aol_count for s in sessions)
    total_breaks = sum(s.break_count for s in sessions)
    latencies = [
        s.feedback_latency_ms for s in sessions if s.feedback_latency_ms is not None
    ]

    judgment_by_session = {j.session_id: j for j in judgments}

    by_protocol: dict[str, dict] = {}
    by_environment: dict[str, int] = {}
    for session in sessions:
        tasking = taskings.get(session.tasking_id)
        if tasking is None:
            continue
        proto = tasking.protocol.value
        entry = by_protocol.setdefault(
            proto,
            {"sessions": 0, "judged": 0, "firstPlace": 0, "meanFigureOfMerit": 0.0},
        )
        entry["sessions"] += 1
        judgment = judgment_by_session.get(session.id)
        if judgment is not None:
            entry["judged"] += 1
            if judgment.rank_of_true_target == 1:
                entry["firstPlace"] += 1
        env = session.monitor_mode.value
        by_environment[env] = by_environment.get(env, 0) + 1

    foms_by_protocol: dict[str, list[float]] = defaultdict(list)
    for session in sessions:
        tasking = taskings.get(session.tasking_id)
        judgment = judgment_by_session.get(session.id)
        if tasking is None or judgment is None:
            continue
        foms_by_protocol[tasking.protocol.value].append(judgment.figure_of_merit)
    for proto, values in foms_by_protocol.items():
        if proto in by_protocol and values:
            by_protocol[proto]["meanFigureOfMerit"] = round(
                sum(values) / len(values), 3
            )

    by_viewer: list[dict] = []
    sessions_by_viewer: dict[UUID | None, list[RVSession]] = defaultdict(list)
    for session in sessions:
        sessions_by_viewer[session.viewer_id].append(session)
    for viewer_id, rows in sessions_by_viewer.items():
        viewer = viewers.get(viewer_id) if viewer_id else None
        viewer_judgments = [
            judgment_by_session[s.id] for s in rows if s.id in judgment_by_session
        ]
        block = _fom_block(viewer_judgments)
        by_viewer.append(
            {
                "id": str(viewer_id) if viewer_id else None,
                "callsign": viewer.callsign if viewer else rows[0].viewer_name,
                "sessions": len(rows),
                **block,
            }
        )
    by_viewer.sort(key=lambda row: row["sessions"], reverse=True)

    lag_summary: dict[str, dict] = {}
    for score in displacement:
        key = str(score.lag)
        entry = lag_summary.setdefault(
            key, {"trials": 0, "hits": 0, "expectedHits": 0.0}
        )
        entry["trials"] += 1
        entry["hits"] += 1 if score.is_hit else 0
        entry["expectedHits"] += 1 / score.pool_size

    active = [s for s in sessions if s.status == RVSessionStatus.ACTIVE]
    judging = _fom_block(judgments)
    by_method: dict[str, int] = {}
    for judgment in judgments:
        method = judgment.fom_method or "rank_process"
        by_method[method] = by_method.get(method, 0) + 1
    judging["byMethod"] = by_method

    return {
        "sessions": {
            "total": len(sessions),
            "active": len(active),
            "byStatus": by_status,
            "byProtocol": by_protocol,
            "byEnvironment": by_environment,
        },
        "protocolHealth": {
            "aolTotal": total_aol,
            "breakTotal": total_breaks,
            "aolPerSession": round(total_aol / len(sessions), 2) if sessions else 0,
        },
        "judging": judging,
        "viewers": by_viewer,
        "feedback": {
            "meanLatencyMs": int(sum(latencies) / len(latencies))
            if latencies
            else None,
            "sessionsWithFeedback": len(latencies),
        },
        "displacement": lag_summary,
    }
