"""May figure of merit.

Edwin May's free-response score is Accuracy × Reliability [MAY-FOM].
Without a fuzzy-set encoding of the transcript against the target, this
module stores a rank-order analogue that still separates the two factors
and stays computable from the sealed judgment plus the typed transcript.

Accuracy is the graded rank of the true target. Rank 1 of N is 1.0.
Last place is 1/N. This is the same information as rank_of_true_target,
rescaled so ARV (N=2) and picture-pool (N=5) sit on one axis.

Reliability is the fraction of viewer output that is signal rather than
declared analytic overlay. Empty transcripts score 0. AOL is not a
penalty when it is rare relative to signal. It is contamination when it
dominates the page. That is the process variable Utts asked future work
to instrument [UTTS-1995].
"""

from core.models.rv import EventKind
from services.protocol import SIGNAL_KINDS

EventLike = object


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
