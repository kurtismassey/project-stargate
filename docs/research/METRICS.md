# Metrics

Every field the platform collects and the reason it exists. Rationale citations refer to `SOURCES.md`. Table and column names match the SQLModel schema in `backend/core/models/`.

## Design rule

A field earns its place by supporting one of four uses. Protocol enforcement during the session, blind judging after it, TTI displacement analysis across a series, or the audit trail that makes results defensible [PAT-REPORT]. Nothing is collected "for later."

## target_pools

| Field | Why |
|---|---|
| `id`, `name`, `description` | Judging requires decoys drawn from the same defined pool as the true target, so pools are first-class [UTTS-1995] |
| `created_at` | Audit trail |

## sealed_targets

| Field | Why |
|---|---|
| `id`, `pool_id` | Membership drives decoy selection at judging time |
| `kind` | `image`, `coordinate_site`, or `arv_outcome`. Picture-pool ARV reuses `image` associates bound by `arv_pairs` [CIA-BRIEF] |
| `payload_b64`, `payload_sha256` | The sealed content and its hash. The hash proves at feedback time that the revealed target is the one sealed at tasking, which is the software form of the sealed-envelope practice [PAT-REPORT] |
| `coordinates` | Optional geographic coordinates for coordinate-cued targets [PUTHOFF-CIA] |
| `title`, `feedback_notes` | Shown only at feedback |
| `source` | Provenance (operator upload, legacy import) for the audit trail |
| `descriptors` | May/SAIC membership map over the shared descriptor vocabulary. Target material. Never serialized toward a viewer before lock [MAY-FOM] |
| `created_at`, `sealed_at` | When the target entered the pool and when it was sealed to a tasking |

Blindness invariant. `payload_b64`, `title`, `feedback_notes`, and `coordinates` of an unsealed pool member never appear in any payload sent to a viewer or live monitor before the session locks. Enforced in the API layer and proven by test.

## series

| Field | Why |
|---|---|
| `id`, `name` | Groups taskings into an ordered sequence for TTI analysis [TART-TTI] |
| `pool_id` | Lag targets must be well defined, so a series draws from one pool [TART-TTI] |
| `feedback_policy` | `immediate` or `deferred`. Immediate feedback is Tart's training variable [TART-TTI] |
| `created_at` | Audit trail |

## arv_pairs

| Field | Why |
|---|---|
| `id`, `pool_id` | Two sealed associates drawn from one pool |
| `side_a_id`, `side_b_id` | The two photographs. One is sealed as the true future-feedback target on the tasking |
| `label_a`, `label_b` | Outcome labels (A/B or event names). Never serialized before lock, and not shown on judging cards |
| `created_at` | Audit trail |

## taskings

| Field | Why |
|---|---|
| `id`, `tasking_number` | Opaque encrypted-style cue, the operational default [CIA-BRIEF] |
| `target_id` | The sealed target. Never serialized toward the viewer before lock |
| `cue_type` | `tasking_number` or `coordinates`. Both historical forms [PUTHOFF-CIA] [CIA-BRIEF] |
| `protocol` | `crv`, `erv`, `arv`, `wrv`. Determines the session engine's gating rules [CRV-MANUAL] [CIA-BRIEF] |
| `environment` | `solo`, `monitored_ai`, `monitored_human`. Evidentiary value differs by environment [CRV-MANUAL] |
| `series_id`, `series_position` | Position in a sequential series, required for lag arithmetic [TART-TTI] |
| `arv_pair_id` | When set, judging uses the two associates instead of a five-member decoy pool |
| `created_at`, `sealed_at` | Tasking lifecycle audit |

## rv_sessions

| Field | Why |
|---|---|
| `id`, `tasking_id` | One session executes one tasking |
| `status` | `active`, `locked`, `judged`, `archived`. Lock is the irreversible gate between viewing and feedback [PROTOCOLS.md] |
| `current_stage` | 1 to 6 for CRV, null for ERV, ARV, and WRV. The state machine's cursor [CRV-MANUAL] |
| `viewer_id` | Foreign key to `viewers`. The population unit [UTTS-1995] |
| `viewer_name` | Denormalized callsign for the session header |
| `operator_id`, `operator_name` | Who cut and sat ops for this session |
| `monitor_id`, `monitor_name` | Human monitor when `monitor_mode` is `monitored_human` [CRV-MANUAL] |
| `monitor_mode`, `monitor_blind` | Whether a monitor participated and whether it was blind, since training and operational modes differ [CRV-MANUAL] |
| `started_at`, `locked_at`, `feedback_at` | Session timeline. `feedback_at - locked_at` is feedback latency [TART-TTI] |
| `feedback_latency_ms` | Materialized for query speed on training analyses [TART-TTI] |
| `aol_count`, `break_count`, `leading_flag_count` | Materialized live-health counters (also derivable from events). AOL rate and structure breaks are the live monitoring signals |

## transcript_events

The multimodal transcript. One append-only row per event, replacing the old chat and drawing JSON blobs.

| Field | Why |
|---|---|
| `id`, `session_id`, `seq` | Strict ordering within a session |
| `stage` | The stage the event was recorded under, for dwell and contamination analysis |
| `kind` | Typed vocabulary from the manual. `cue`, `ideogram`, `ideogram_a`, `ideogram_b`, `sensory`, `dimensional`, `aesthetic_impact`, `emotional_impact`, `tangible`, `intangible`, `aol`, `aol_break`, `aol_signal`, `sketch`, `monitor_prompt`, `viewer_note`, `break`, `stage_advance`, `lock`, `feedback_view` [CRV-MANUAL] |
| `payload` | JSON. Text for verbal events, stroke data for ink, reason codes for breaks |
| `flagged_leading` | Set on `monitor_prompt` events that a reviewer (or the automatic patter filter) judges to be leading. The monitor-leading flag required for session health [CRV-MANUAL] |
| `created_at`, `ms_since_start` | Every event timestamped, the instrumentation both AIR reviewers found missing [AIR-1995] |

## stage_records

| Field | Why |
|---|---|
| `id`, `session_id`, `stage` | One row per stage visit |
| `entered_at`, `exited_at`, `dwell_ms` | Stage dwell is a live health signal and a process variable Utts asked future research to instrument [UTTS-1995] |

## judgments

| Field | Why |
|---|---|
| `id`, `session_id` | Judged transcript |
| `judge_kind` | `human` or `llm`. The official score is human, the LLM is a second opinion [UTTS-1995] |
| `pool_target_ids` | The exact pool presented, in presentation order, for reproducibility [PAT-REPORT] |
| `rankings` | JSON list of (target_id, rank) |
| `rank_of_true_target`, `pool_size` | The scored outcome. First-place probability under the null is 1/pool_size [UTTS-1995] |
| `accuracy` | Official May accuracy `|T ∩ R| / |T|` when both encodings have mass. Otherwise graded rank `(N - rank + 1) / N` [MAY-FOM] |
| `reliability` | Official May reliability `|T ∩ R| / |R|` when both encodings have mass. Otherwise signal / (signal + declared AOL) [MAY-FOM] [UTTS-1995] |
| `figure_of_merit` | `accuracy × reliability`. Official composite [MAY-FOM] |
| `fom_method` | `fuzzy` or `rank_process`. Says which definition filled the three scores |
| `response_descriptors` | Judge encoding of the transcript against the same vocabulary. Compared to `sealed_targets.descriptors`, never shown the target memberships [MAY-FOM] |
| `notes`, `created_at` | Judge commentary, audit |

## operators

| Field | Why |
|---|---|
| `id`, `callsign` | Named lab staff. The CRV pair is viewer plus monitor [CRV-MANUAL] |
| `passphrase_hash` | PBKDF2 verifier. Never serialized. Empty means this callsign is still open |
| `notes`, `created_at` | Roster audit |

## operator_tokens

| Field | Why |
|---|---|
| `id`, `operator_id` | Issued session bound to one operator |
| `token_hash` | SHA-256 of the secret sent once at sign-in. The raw token is not stored |
| `created_at` | Audit |

## viewers

| Field | Why |
|---|---|
| `id`, `callsign` | Named source. Utts statistics group by viewer, not by session [UTTS-1995] |
| `notes`, `created_at` | Roster audit |

## displacement_scores

| Field | Why |
|---|---|
| `id`, `session_id`, `series_id` | The trial being scored and its series |
| `lag` | -2, -1, +1, +2. Lag 0 lives in `judgments` [TART-TTI] |
| `lag_target_id` | The target of trial n+lag |
| `rank`, `is_hit` | Blind rank of this transcript against the lag target's pool context, hit means rank 1 [TART-TTI] |
| `judgment_id` | The judging pass that produced the rank, for audit |
| `created_at` | Audit |

## analyst_reports

| Field | Why |
|---|---|
| `id`, `session_id` | Post-lock LLM analysis, one or more per session |
| `model` | Which model produced it |
| `summary`, `correspondences` | Narrative and element-level correspondence list against the sealed target |
| `advisory_score` | 0 to 7 advisory accuracy. Never the official score [UTTS-1995] |
| `created_at` | Must be later than the session's `locked_at`, enforced |

## audit_log

| Field | Why |
|---|---|
| `id`, `actor`, `action`, `entity_type`, `entity_id`, `detail`, `created_at` | Who sealed, unsealed, locked, revealed, judged, and when. The unedited master log practice from the founding contract, in software [PAT-REPORT] |

## Legacy tables

`session`, and the legacy score data embedded in it, remain untouched. The migration copies each legacy session into the new model (tasking, sealed target from the stored image, transcript events from chat and drawings, analyst report from the stored analysis) and marks the new rows `archived` with `source = legacy`. History survives, and old rows stay readable [requirement 7 of the product brief].
