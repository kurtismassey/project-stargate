<div align="center">

![Checks](https://github.com/kurtismassey/project-stargate/actions/workflows/checks.yaml/badge.svg?branch=main)

</div>

<div style="padding-top: 25px; padding-bottom: 25px" align="center"><img src="./resources/project_stargate.png" width="60%"></div>

# Project Stargate

A remote viewing research platform. It runs protocol-faithful CRV and ERV sessions with sealed double-blind targeting, records a typed multimodal transcript with research-scale instrumentation, scores sessions by independent rank-order judging, and stores the sequential-series data that trans-temporal inhibition analyses need. Built the way a contractor lab would ship it if the SRI/CIA Star Gate program were funded today.

The protocols are implemented from the declassified record, not from folklore. The knowledge base at [`docs/research/`](docs/research/) cites every primary source, including the 1986 Coordinate Remote Viewing manual (Swann/Smith), Puthoff's account of the CIA-initiated SRI program, the Puthoff/Targ Perceptual Augmentation Techniques final report, the DIA Star Gate methodology briefing, Tart's trans-temporal inhibition chapter, and the Utts and Hyman assessments from the 1995 AIR evaluation.

## The core loop

1. **Tasking.** The operator seals a target from a pool. The server picks it at random and the viewer only ever receives an opaque tasking number (or coordinates). Every seal gets a SHA-256 receipt.
2. **Chamber.** The session runs in a viewing chamber with a paper objectification surface. CRV sessions start at Stage I and progress through the six stages in order. The engine refuses out-of-structure entries, exactly as a monitor would.
3. **Structure.** Ideogram, A and B components, sensory data, dimensionals, the Stage IV matrix, interrogation, rendering. AOL declarations and breaks are first-class transcript events with timestamps.
4. **Lock.** Irreversible. The transcript closes and only then do feedback, judging, and analysis open. Blindness before lock is enforced by the API and proven by test.
5. **Feedback.** The seal breaks, the target reveals, and feedback latency is recorded (Tart's training variable).
6. **Judgment.** A blind judge rank-orders the true target against pool decoys. That rank is the score of record. The LLM analyst gives an advisory second opinion, never the official score.

## Protocol enforcement

- Stage II cannot accept objectification before a complete Stage I ideogram trio exists.
- After an AOL declaration, signal entries are refused until the AOL break is objectified.
- The monitor (AI or engine patter) never leads, never names content, and never sees the target. A leading-language filter discards anything that fishes for content.
- ERV runs as a free-form variant with the same blindness, lock, and transcript rules.
- Sequential series record trial positions so hits can be scored at lags -2 to +2 for TTI analysis.

## Stack

- **Backend** FastAPI, SQLModel, versioned startup migrations. SQLite by default, Postgres via `DATABASE_URL`.
- **Frontend** Next.js, Tailwind. REST for session control, WebSocket for live ink relay.
- **AI** Gemini via LangChain for the monitor and post-lock analyst. Both fail closed, the session loop runs fully without `GOOGLE_API_KEY`.

## Getting started

```bash
make install
make dev
```

Backend on `http://localhost:8000`, frontend on `https://localhost:3000`. Optionally populate `.env` from `example.env` to enable AI assistance.

```bash
make test      # backend pytest + frontend vitest
make lint      # ruff + mypy + tsc + eslint
```

The backend suite proves the invariants: target bytes absent from every pre-lock payload, stage gating, AOL gating, displacement recording on a sequential series, and seal verification at feedback.

## Research documentation

| Document | Contents |
|---|---|
| [`docs/research/SOURCES.md`](docs/research/SOURCES.md) | Every primary source read, with URLs and what was taken |
| [`docs/research/PROGRAM.md`](docs/research/PROGRAM.md) | Program history, SCANATE through STAR GATE, people, the 1995 closeout |
| [`docs/research/PROTOCOLS.md`](docs/research/PROTOCOLS.md) | CRV stages, ERV, monitor rules, AOL, breaks, judging |
| [`docs/research/TART-TTI.md`](docs/research/TART-TTI.md) | Trans-temporal inhibition and its schema requirements |
| [`docs/research/METRICS.md`](docs/research/METRICS.md) | Every field collected and why |
| [`docs/research/PRODUCT-SPEC.md`](docs/research/PRODUCT-SPEC.md) | The functional spec, mapped to sources |
