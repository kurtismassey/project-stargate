"""May figure of merit.

Edwin May's free-response score is Accuracy × Reliability [MAY-FOM].
When both the sealed target and the response have descriptor encodings,
accuracy is |T ∩ R| / |T| and reliability is |T ∩ R| / |R|. That is the
published fuzzy-set method.

Without encodings the module stores a rank-process analogue so older
sessions still have a composite on the same 0 to 1 scale. Graded rank
stands in for accuracy. Signal versus declared AOL stands in for
reliability. Utts asked future work to instrument that process
variable [UTTS-1995]. It is not May's reliability.
"""

from dataclasses import dataclass

from core.models.rv import EventKind
from services import descriptors
from services.protocol import SIGNAL_KINDS

EventLike = object

FOM_FUZZY = "fuzzy"
FOM_RANK_PROCESS = "rank_process"


@dataclass(frozen=True)
class OfficialScores:
    accuracy: float
    reliability: float
    figure_of_merit: float
    method: str


def graded_accuracy(rank: int, pool_size: int) -> float:
    if pool_size < 1 or rank < 1 or rank > pool_size:
        return 0.0
    return (pool_size - rank + 1) / pool_size


def transcript_reliability(kinds: list[EventKind], aol_count: int) -> float:
    signal = sum(1 for kind in kinds if kind in SIGNAL_KINDS)
    if signal <= 0:
        return 0.0
    declared_aol = max(0, aol_count)
    return signal / (signal + declared_aol)


def figure_of_merit(accuracy: float, reliability: float) -> float:
    return max(0.0, min(1.0, accuracy * reliability))


def official_scores(
    rank: int,
    pool_size: int,
    kinds: list[EventKind],
    aol_count: int,
    target_encoding: dict | None,
    response_encoding: dict | None,
) -> OfficialScores:
    if descriptors.has_mass(target_encoding) and descriptors.has_mass(
        response_encoding
    ):
        accuracy = descriptors.fuzzy_accuracy(target_encoding, response_encoding)
        reliability = descriptors.fuzzy_reliability(target_encoding, response_encoding)
        return OfficialScores(
            accuracy=accuracy,
            reliability=reliability,
            figure_of_merit=figure_of_merit(accuracy, reliability),
            method=FOM_FUZZY,
        )
    accuracy = graded_accuracy(rank, pool_size)
    reliability = transcript_reliability(kinds, aol_count)
    return OfficialScores(
        accuracy=accuracy,
        reliability=reliability,
        figure_of_merit=figure_of_merit(accuracy, reliability),
        method=FOM_RANK_PROCESS,
    )
