# Trans-temporal inhibition and what it demands of the schema

Source: Charles T. Tart, "Improving Real-Time ESP by Suppressing the Future: Trans-Temporal Inhibition" [TART-TTI]. Citation keys refer to `SOURCES.md`.

## The finding

Tart trained percipients on a ten-choice trainer with immediate feedback. Each trial the machine selected a target from a fixed ordered set, the percipient made a choice, and the true target was revealed at once. Because targets form a recorded sequence, every response can be scored not only against the target of its own trial (lag 0, a real-time hit) but against the target of the previous trial (lag -1), the next trial (lag +1), and beyond (lags -2, +2).

The result that matters here has two parts. Talented percipients scored above chance in real time. The same percipients scored significantly below chance on the immediately adjacent targets, missing the -1 and +1 targets more often than chance predicts. Suppression of the temporal neighbors accompanied real-time hitting, and the correlation between real-time hit rate and adjacent-target suppression was itself significant.

## The model

Tart's interpretation is trans-temporal inhibition. By analogy with lateral inhibition in sensory neurophysiology, where a stimulated receptor suppresses its spatial neighbors to sharpen edges, the mind sharpens the real-time psi signal by inhibiting information about temporally adjacent targets. Displacement misses are not noise. They are structure, and they are evidence of a tuned channel.

Two operational corollaries follow.

Immediate feedback is a training variable. Tart's design treats psi as a learnable perceptual skill that decays without prompt knowledge of results. Feedback latency is therefore data, not housekeeping.

Displacement must be measurable at scale. Without a recorded target sequence and per-trial timestamps, displacement analysis is impossible. This was a gap in most of the historical RV record, and this platform closes it.

## Schema requirements (implemented, see METRICS.md)

1. Sequential series. A `Series` groups taskings into an ordered sequence. Each tasking carries its `series_position`. Targets in a series are drawn from a recorded pool so that "the target of trial n+1" is well defined even before trial n+1 runs.
2. Feedback latency. Each session stores `locked_at` and `feedback_at`. Feedback latency is the difference, recorded in milliseconds. Training series aim for latency near zero.
3. Direct hits. Judge output records the rank of the true target for the session's own trial (lag 0).
4. Displacement scores. For each judged session in a series, the platform also stores the rank (or hit/miss) of the session transcript judged against the targets at lags -2, -1, +1, +2, where those trials exist. Stored per lag in `displacement_scores`, one row per (session, lag).
5. Population analysis. With the above, the TTI analyses run as queries. Real-time hit rate versus lag-specific hit rate, suppression significance per viewer, and the hit-versus-suppression correlation across viewers.

## What counts as a hit at a lag

For picture-pool RV the platform uses the judging machinery rather than the forced-choice machinery. A lag L score for session n is the blind judge's rank of session n's transcript against the target of trial n+L within the same pool context. A lag hit is rank 1. This generalizes Tart's forced-choice counting to free-response RV while preserving the analysis, and it is why displacement rows reference judge output rather than raw guesses.
