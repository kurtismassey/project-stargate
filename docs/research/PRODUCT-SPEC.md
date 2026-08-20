# Product specification

What the software must do, each requirement mapped to the source that justifies it. Citation keys refer to `SOURCES.md`. Schema detail lives in `METRICS.md`, protocol detail in `PROTOCOLS.md`.

## The product in one paragraph

A remote viewing research console for a single-operator lab. The operator seals targets into pools, cuts taskings with opaque cue numbers, and runs protocol-enforced sessions in a viewing chamber. The chamber keeps the viewer blind, walks CRV structure stage by stage (or free-form for ERV, ARV, and WRV), records a typed multimodal transcript with full timestamps, and locks before any feedback. After lock the target unseals, the analyst model gives an advisory read, and blind rank-order judging produces the official score. Series of sessions accumulate the displacement and latency data Tart's trans-temporal inhibition analysis needs.

## Functional requirements

### F1. Sealed tasking

- Operators create target pools and sealed targets (image upload or coordinate site). Targets get a SHA-256 at seal time [PAT-REPORT].
- Cutting a tasking binds one sealed target, assigns an opaque tasking number (default cue) or exposes coordinates (supported cue), and never exposes anything else [CIA-BRIEF] [PUTHOFF-CIA].
- Optionally assigns the tasking to a series with a position for TTI [TART-TTI].

### F2. Blindness invariant (hard)

- No API response, WebSocket frame, or page payload delivered to a viewer or live monitor before lock contains target payload, title, notes, or (for tasking-number cues) coordinates [PAT-REPORT] [CRV-MANUAL].
- The AI monitor and any live-health model never receive target material for an unlocked session [product brief 5, 9].
- Proven by automated test that walks every pre-lock payload for a seeded session and asserts the sealed bytes and title are absent.

### F3. CRV session engine (state machine)

- Sessions start at Stage I. The engine holds `current_stage` and refuses events whose kind is not legal in the current stage [CRV-MANUAL].
- Stage I accepts ideogram, ideogram A, ideogram B. Stage II opens only after a complete ideogram/A/B trio exists. Stage III and later open only after the prior stage recorded at least one substantive event and an explicit `stage_advance` [CRV-MANUAL].
- AOL declarations and breaks are legal in every stage. After an `aol` event, further signal events are refused until the matching `aol_break` is objectified [CRV-MANUAL].
- Lock is explicit, irreversible, and required before feedback or analysis [PROTOCOLS.md].
- ERV, ARV, and WRV sessions skip stage gating but keep blindness, lock, transcript, and timestamps [CIA-BRIEF].
- Proven by automated tests for stage gating (Stage II refuses sensory before Stage I ideogram exists) and AOL gating.

### F4. Multimodal transcript

- Every viewer entry, sketch stroke set, monitor prompt, break, and lifecycle transition is one typed, timestamped, append-only `transcript_event` [AIR-1995] [CRV-MANUAL].
- Ink syncs live over WebSocket so a human monitor (or the operator) can watch the paper in real time [product brief 3].

### F5. Monitor (AI) within the manual's envelope

- Prescribed patter only. Give the cue, acknowledge objectification, call structure violations, prompt AOL breaks when the viewer's language turns analytic, coach ideogram re-cueing in Stage I [CRV-MANUAL].
- Never leads, never names, never asks the viewer to interpret a sketch as an object [CRV-MANUAL] [product brief FORBIDDEN].
- Blind. Receives the transcript so far and the stage, never the target [F2].
- Fails closed. Without `GOOGLE_API_KEY` the monitor stays silent and the session loop runs unaffected [product brief VERIFY].
- Every monitor utterance is a `monitor_prompt` event and can carry a `flagged_leading` mark for review [CRV-MANUAL].

### F6. Live session health

- AOL rate, break count, stage dwell, and leading-flag count computed from the transcript and shown in the chamber's instrument chrome without exposing content that would break blindness [product brief 5, 9] [UTTS-1995].

### F7. Lock, feedback, latency

- Lock stamps `locked_at`. Feedback view unseals the target, stamps `feedback_at`, and materializes `feedback_latency_ms` [TART-TTI].
- Feedback shows the sealed payload plus its hash so the operator can verify the seal [PAT-REPORT].

### F8. Judging workflow

- After lock, a judging screen presents the transcript beside the true target and pool decoys in shuffled order. The judge ranks all pool members. Rank of the true target and pool size persist [UTTS-1995].
- ARV judging is binary. The pool is the two sealed associates, unmarked. A first-place rank of the true side is a hit (chance 1/2).
- For series members, the same machinery scores lags -2 to +2 into `displacement_scores`. A series runner seals N sequential taskings in one cut so TTI has a recorded target sequence [TART-TTI].
- LLM analyst produces an advisory report after lock, against the sealed target only, never against a generated "target model" image [product brief 9].

### F9. Population statistics

- Home console shows first-place rate versus 1/pool-size chance, mean rank, session counts by protocol and environment, AOL rates, mean feedback latency, and displacement summaries [UTTS-1995] [TART-TTI].

### F10. Migration and storage

- SQLModel schema, SQLite by default (`sqlite+aiosqlite`), Postgres via `DATABASE_URL` [product brief 7, 8].
- Startup migration runner with a `schema_migrations` version table. Legacy `session` rows migrate into the new model without loss [METRICS.md].

## Experience requirements

### X1. Brand

Dark instrument chrome, near-black neutrals with a single instrument accent, precise typography (monospaced numerals for coordinates and tasking numbers), restrained motion. No cream, no teal, no yellow banner [product brief 6].

### X2. The chamber

Entering a session should read as entering a viewing chamber. Dark chrome around a paper objectification surface, since paper is the historically correct working material [CRV-MANUAL]. Stage rail shows I through VI with locked stages visibly gated. The cue is presented the way a monitor would give it, alone on the paper.

### X3. Core loop

Tasking, then chamber, then structured session, then lock, then feedback, then judgment. Each step one polished surface [product brief 6].

### F11. Associative remote viewing

- An `arv_pairs` row binds two sealed associates. Cutting an ARV tasking seals one side as the future feedback photograph. The viewer receives only the opaque cue [CIA-BRIEF].
- Chamber vocabulary is free-form (same envelope as ERV). Opening monitor patter names the feedback photograph, never a Stage I ideogram.
- After lock the judge ranks the two associates. Labels stay off the pre-lock wire and off the judging cards.

### F12. Written remote viewing

- WRV is a runnable protocol. Written and phonetic objectification (`viewer_note`) is first-class. Same blindness, lock, and transcript rules as ERV [CIA-BRIEF].
- The chamber defaults to a written pad. Ideograms are refused.

## Out of scope for this slice

Auth and multi-operator tenancy, human-monitor pairing UX beyond live ink watching, outbound-beacon targets.
