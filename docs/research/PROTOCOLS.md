# Protocols

The protocol rules the platform enforces, taken from the primary record. The normative source for CRV is the 1986 Coordinate Remote Viewing manual [CRV-MANUAL]. Operational definitions of ERV and WRV come from the DIA Star Gate briefing [CIA-BRIEF]. Judging comes from the SRI/SAIC research practice as described by Utts [UTTS-1995] and Puthoff [PUTHOFF-CIA]. Citation keys refer to `SOURCES.md`.

## Core CRV theory, in brief

The manual's model: information from the site arrives on a "signal line" and is processed below awareness in a matrix of pre-existing knowledge. The viewer's job is to detect the signal and objectify it (write or sketch it on paper) before the analytic mind can overwhelm it. The aperture through which signal arrives is narrow at first and widens stage by stage, which is why stage order is not a style preference. It is the mechanism [CRV-MANUAL].

Two consequences drive the whole product design.

Structure is everything. The manual's dictum is that correct structure gives content its meaning, and a viewer who is "in structure" can be trusted while one who free-associates cannot. The platform therefore records a typed, structured transcript rather than a chat log, and gates what event types each stage accepts.

Objectification is mandatory. Every impression, every analytic intrusion, and every break must be written down. Anything not objectified stays in the system and contaminates later data. The platform makes objectification the only way to move forward.

## Analytic overlay (AOL)

AOL is the conscious mind's premature interpretation of the signal, such as naming a site "Golden Gate Bridge" when the signal is merely "long, red, spanning." The manual treats AOL as the primary noise source [CRV-MANUAL].

Rules the platform enforces.

- AOL is declared the moment it is noticed, written in the transcript as "AOL break" with the content, and set aside.
- After declaring, the viewer pauses briefly and resumes from structure. The session record must show the declaration before further signal entries are accepted.
- AOL is not a failure and is never penalized. Suppressing AOL rather than declaring it is the failure mode. Some AOL is signal-derived (the manual's AOL/S, an AOL that keeps returning and matches other data), and Stage IV gives it its own column.
- A first-class AOL event with its own timestamps enables the live AOL-rate signal and post-hoc contamination analyses.

## Break types

All breaks are declared in writing and timestamped [CRV-MANUAL].

| Break | Trigger | Platform event |
|---|---|---|
| AOL break | Analytic intrusion | `aol` followed by `aol_break` |
| Confusion break | Viewer disoriented, output entangled | `break` with reason `confusion` |
| Too-much break | Signal arriving faster than objectification | `break` with reason `too_much` |
| Aesthetic impact break | Overwhelming subjective response to the site (Stage III and later) | `break` with reason `aesthetic_impact` |
| Emotional impact break | Viewer's own or site emotion floods the process | `break` with reason `emotional_impact` |
| Bio break | Physical needs | `break` with reason `bio` |

A session can also be suspended and resumed across sittings. Suspension is an audit event, not a data loss.

## The six CRV stages

Sessions start at Stage I. A later stage opens only when the prior stage's required structure exists on paper. Summarized from [CRV-MANUAL].

### Stage I. Ideogram and first decoding

The monitor (or the system, in solo mode) gives the cue, which is the coordinate or tasking number and never a description. The viewer writes the cue, and the hand produces an ideogram, a spontaneous kinesthetic mark that expresses the site's major gestalt.

The viewer then decodes the ideogram in strict order. The A component expresses the feeling and motion of the line (such as "rising, solid"). The B component is the first analytic response, a one-word gestalt (such as "structure," "water," "land," "mountain"). Multiple ideogram attempts against the same cue are normal, and the manual prescribes re-cueing when the ideogram fails to decode. Stage I is complete when at least one ideogram has an objectified A and B.

### Stage II. Sensory contact

The aperture widens to sensory data. Colors, textures, temperatures, sounds, smells, tastes, and energetic qualities, objectified as single words or short phrases. Dimensional hints may begin appearing near the end. Correct Stage II data confirms signal-line contact. The stage often terminates in aesthetic impact, the viewer's first whole-body response to the site, which must be declared.

### Stage III. Dimension, aesthetics, motion

Dimensional expression of the site. Sizes, verticals, horizontals, volumes, mass, and density, plus mobility and energy. Sketching begins in earnest here. Stage III sketches are not drawings of "what the site looks like" but objectified spatial impressions. Aesthetic impact is a formal, declared event.

### Stage IV. The matrix

Emergent qualitative data organized into labeled columns. S2 (sensory), D (dimensional), AI (aesthetic impact), EI (emotional impact), T (tangibles at the site), I (intangibles, such as purpose or function), AOL, and AOL/S. The viewer sweeps the matrix as data emerges rather than filling columns mechanically. Stage IV is where site meaning starts to assemble without the viewer naming the site.

### Stage V. Interrogation

Controlled interrogation of the signal line based on Stage IV data. The manual's terms are emanations from objects, attributes, and subjects (cognitrons). Stage V is the only stage where prompted exploration is legitimate, and the prompts come from the viewer's own prior objectified data, never from the monitor's outside knowledge.

### Stage VI. Three-dimensional modeling

Direct site involvement through rendering, such as clay or constructed models, detailed composite sketches in this platform's terms. Stage VI output is the closest the protocol comes to a site description deliverable.

## The monitor

The manual defines the monitor as a protocol officer, not a guide [CRV-MANUAL].

- Sits at the opposite end of the table. Provides the cue and nothing else about the target.
- Watches structure. If the viewer produces Stage IV content during Stage II, the monitor returns the viewer to proper structure ("in structure," "declare your break").
- Records session events and timestamps.
- Uses limited, prescribed patter. Permissible prompts are structural ("objectify that," "resume," re-giving the cue) and Stage V interrogatives grounded in the viewer's own data.
- Never leads. Never asks the viewer to interpret a sketch as a named object. Never confirms or denies content during the session.
- Blindness. In operations the monitor is blind to the target. In early training a monitor may know the site to coach structure, and the platform records which mode a session ran in, because the evidentiary value differs [CRV-MANUAL] [PUTHOFF-CIA].

The AI monitor in this platform implements exactly this envelope and nothing more.

## Targeting and blindness

- The viewer receives only a cue, either geographic coordinates (the original SCANATE form) or an opaque encrypted tasking number (later operational practice) [PUTHOFF-CIA] [CIA-BRIEF].
- The target itself (photo, site dossier) is sealed at tasking time and revealed to the viewer only at feedback, after the session locks. Nobody in contact with the viewer during the session knows the target in double-blind mode [PAT-REPORT].
- Feedback after lock, never during. Immediate post-lock feedback is desirable for training and required for TTI series (see `TART-TTI.md`).

## ERV

Extended Remote Viewing, the Fort Meade unit's other primary method [CIA-BRIEF]. The viewer works in a darkened, quiet room in a deeply relaxed, borderline-sleep state, verbalizing impressions while a monitor takes notes and asks minimal questions. Sessions are long (45 minutes and up), data arrives as imagery and narrative rather than staged structure. The platform models ERV as a protocol variant with a free-form transcript, monitor notes, the same blindness and lock rules, and no stage gating.

## WRV

Written Remote Viewing appears in the DIA briefing as a sanctioned method, automatic-writing and phonetic [CIA-BRIEF]. The platform runs it as a free-form protocol with the same blindness, lock, and transcript rules as ERV. The chamber puts writing first. The viewer objectifies fragments, words, and phrases on the page. Ideograms and CRV stage structure are refused.

## ARV

Associative Remote Viewing tasks the viewer on a future feedback photograph bound to an outcome [CIA-BRIEF]. The engine seals two associates (side A and side B) and randomly assigns which side is the true future-feedback photo. The viewer receives only the opaque cue and describes the photograph they will see at feedback.

After lock, judging is binary rank-order of the two associates. The cards do not mark the true side. Rank 1 of the true associate is a hit. Chance under the null is 1/2. Outcome labels stay server-side so a live judge cannot read the mapping off the wire.

## Judging

The scientific score is independent, blind, rank-order judging [UTTS-1995] [PUTHOFF-CIA].

- A judging pool contains the true target plus N-1 decoys drawn from the same pool the target was sealed from (pool size 5 was typical at SRI and SAIC).
- A judge who was not present at the session, and who is blind to which pool member is the true target, ranks every pool member against the session transcript. Rank 1 means best match.
- Under the null hypothesis the true target lands at rank 1 with probability 1/N. Population statistics accumulate over sessions (sum of ranks, first-place rate, effect size).
- The AIR record shows what happens when judging is skipped and vivid matches are eyeballed [AIR-1995]. The platform therefore treats the judge workflow as the only source of an official score. LLM analyst output is stored, displayed, and labeled as a second opinion.
