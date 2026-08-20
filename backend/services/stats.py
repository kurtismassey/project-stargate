"""Population statistics.

The aggregates the ops console shows. Chance baselines follow the
rank-order judging model, first place with probability 1/pool_size under
the null [UTTS-1995]. Displacement summaries follow [TART-TTI].
"""

from core.models.rv import (
    DisplacementScore,
    Judgment,
    RVSession,
    RVSessionStatus,
)
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession


async def population_stats(db: AsyncSession) -> dict:
    sessions = list((await db.exec(select(RVSession))).all())
    judgments = list((await db.exec(select(Judgment))).all())
    displacement = list((await db.exec(select(DisplacementScore))).all())

    by_status: dict[str, int] = {}
    for session in sessions:
        by_status[session.status.value] = by_status.get(session.status.value, 0) + 1

    total_aol = sum(s.aol_count for s in sessions)
    total_breaks = sum(s.break_count for s in sessions)
    latencies = [
        s.feedback_latency_ms for s in sessions if s.feedback_latency_ms is not None
    ]

    first_place = sum(1 for j in judgments if j.rank_of_true_target == 1)
    expected_first = sum(1 / j.pool_size for j in judgments)
    mean_rank = (
        sum(j.rank_of_true_target for j in judgments) / len(judgments)
        if judgments
        else None
    )

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

    return {
        "sessions": {
            "total": len(sessions),
            "active": len(active),
            "byStatus": by_status,
        },
        "protocolHealth": {
            "aolTotal": total_aol,
            "breakTotal": total_breaks,
            "aolPerSession": round(total_aol / len(sessions), 2) if sessions else 0,
        },
        "judging": {
            "judgedSessions": len(judgments),
            "firstPlaceMatches": first_place,
            "expectedFirstPlace": round(expected_first, 2),
            "meanRankOfTrueTarget": round(mean_rank, 2) if mean_rank else None,
        },
        "feedback": {
            "meanLatencyMs": int(sum(latencies) / len(latencies))
            if latencies
            else None,
            "sessionsWithFeedback": len(latencies),
        },
        "displacement": lag_summary,
    }
