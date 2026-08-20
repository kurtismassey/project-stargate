"""CRV protocol state machine.

Pure functions over an ordered event history. No database access, so the
gating rules are testable in isolation and mirrored in the frontend
(frontend/lib/protocol.ts).

Rules follow the 1986 CRV manual [CRV-MANUAL], see docs/research/PROTOCOLS.md:
- Sessions start at Stage I and progress in order.
- Stage II opens only after a complete ideogram/A/B trio exists in Stage I.
- Each later stage opens only after the prior stage recorded substantive
  structure and an explicit stage_advance.
- After an AOL declaration, signal events are refused until the AOL break
  is objectified.
"""

from dataclasses import dataclass

from core.models.rv import EventKind, Protocol

CRV_STAGES = (1, 2, 3, 4, 5, 6)

# Event kinds that are legal in any stage of any protocol.
ALWAYS_ALLOWED: frozenset[EventKind] = frozenset(
    {
        EventKind.AOL,
        EventKind.AOL_BREAK,
        EventKind.BREAK,
        EventKind.MONITOR_PROMPT,
        EventKind.VIEWER_NOTE,
    }
)

# Signal-line event kinds a viewer produces. Refused while an AOL is open.
SIGNAL_KINDS: frozenset[EventKind] = frozenset(
    {
        EventKind.IDEOGRAM,
        EventKind.IDEOGRAM_A,
        EventKind.IDEOGRAM_B,
        EventKind.SENSORY,
        EventKind.DIMENSIONAL,
        EventKind.AESTHETIC_IMPACT,
        EventKind.EMOTIONAL_IMPACT,
        EventKind.TANGIBLE,
        EventKind.INTANGIBLE,
        EventKind.AOL_SIGNAL,
        EventKind.SKETCH,
    }
)

# Per-stage signal vocabulary for CRV [CRV-MANUAL].
CRV_STAGE_ALLOWED: dict[int, frozenset[EventKind]] = {
    1: frozenset({EventKind.IDEOGRAM, EventKind.IDEOGRAM_A, EventKind.IDEOGRAM_B}),
    2: frozenset({EventKind.SENSORY, EventKind.AESTHETIC_IMPACT, EventKind.SKETCH}),
    3: frozenset(
        {
            EventKind.DIMENSIONAL,
            EventKind.AESTHETIC_IMPACT,
            EventKind.SKETCH,
        }
    ),
    4: frozenset(
        {
            EventKind.SENSORY,
            EventKind.DIMENSIONAL,
            EventKind.AESTHETIC_IMPACT,
            EventKind.EMOTIONAL_IMPACT,
            EventKind.TANGIBLE,
            EventKind.INTANGIBLE,
            EventKind.AOL_SIGNAL,
            EventKind.SKETCH,
        }
    ),
    5: frozenset(
        {
            EventKind.SENSORY,
            EventKind.DIMENSIONAL,
            EventKind.TANGIBLE,
            EventKind.INTANGIBLE,
            EventKind.SKETCH,
        }
    ),
    6: frozenset(
        {
            EventKind.DIMENSIONAL,
            EventKind.TANGIBLE,
            EventKind.INTANGIBLE,
            EventKind.SKETCH,
        }
    ),
}

# Free-form protocols keep blindness, lock, and the typed transcript
# but skip CRV stage gating. Shared by ERV (narrative), ARV (future
# feedback photograph), and WRV (written / phonetic) [CIA-BRIEF].
FREEFORM_ALLOWED: frozenset[EventKind] = frozenset(
    {
        EventKind.SENSORY,
        EventKind.DIMENSIONAL,
        EventKind.EMOTIONAL_IMPACT,
        EventKind.SKETCH,
    }
)
ERV_ALLOWED = FREEFORM_ALLOWED
ARV_ALLOWED = FREEFORM_ALLOWED
WRV_ALLOWED = FREEFORM_ALLOWED
FREEFORM_PROTOCOLS: frozenset[Protocol] = frozenset(
    {Protocol.ERV, Protocol.ARV, Protocol.WRV}
)


@dataclass(frozen=True)
class EventView:
    """The slice of a transcript event the state machine needs."""

    kind: EventKind
    stage: int | None


@dataclass(frozen=True)
class Refusal:
    code: str
    message: str


def open_aol(events: list[EventView]) -> bool:
    """True when the latest AOL declaration has no AOL break after it."""
    for event in reversed(events):
        if event.kind == EventKind.AOL_BREAK:
            return False
        if event.kind == EventKind.AOL:
            return True
    return False


def stage_one_complete(events: list[EventView]) -> bool:
    """A complete ideogram trio exists: ideogram, then A, then B."""
    want = [EventKind.IDEOGRAM, EventKind.IDEOGRAM_A, EventKind.IDEOGRAM_B]
    idx = 0
    for event in events:
        if event.stage == 1 and event.kind == want[idx]:
            idx += 1
            if idx == len(want):
                return True
    return False


# What "substantive structure" means per stage, for advancement [CRV-MANUAL].
STAGE_ADVANCE_REQUIREMENT: dict[int, frozenset[EventKind]] = {
    2: frozenset({EventKind.SENSORY}),
    3: frozenset({EventKind.DIMENSIONAL, EventKind.SKETCH}),
    4: frozenset(
        {
            EventKind.SENSORY,
            EventKind.DIMENSIONAL,
            EventKind.AESTHETIC_IMPACT,
            EventKind.EMOTIONAL_IMPACT,
            EventKind.TANGIBLE,
            EventKind.INTANGIBLE,
            EventKind.AOL_SIGNAL,
        }
    ),
    5: frozenset({EventKind.TANGIBLE, EventKind.INTANGIBLE}),
}


def can_advance_stage(current_stage: int, events: list[EventView]) -> Refusal | None:
    """Whether the session may advance from current_stage to the next."""
    if current_stage >= 6:
        return Refusal("last_stage", "Stage VI is the final stage.")
    if open_aol(events):
        return Refusal(
            "aol_open",
            "Objectify the AOL break before advancing. Declared overlay must "
            "be set aside in structure.",
        )
    if current_stage == 1:
        if not stage_one_complete(events):
            return Refusal(
                "stage_one_incomplete",
                "Stage I is incomplete. Objectify the ideogram, then the A "
                "component, then the B component.",
            )
        return None
    required = STAGE_ADVANCE_REQUIREMENT[current_stage]
    for event in events:
        if event.stage == current_stage and event.kind in required:
            return None
    return Refusal(
        "stage_incomplete",
        f"Stage {current_stage} has no objectified structure yet. Record "
        "stage data before advancing.",
    )


def validate_event(
    protocol: Protocol,
    current_stage: int | None,
    kind: EventKind,
    events: list[EventView],
) -> Refusal | None:
    """Whether an event of this kind may be appended right now.

    Returns None when legal, or a Refusal explaining the structure rule.
    Lifecycle kinds (cue, stage_advance, lock, feedback_view) are engine
    internal and validated by their own code paths.
    """
    if kind in ALWAYS_ALLOWED:
        return None

    if kind in SIGNAL_KINDS and open_aol(events):
        return Refusal(
            "aol_open",
            "AOL declared. Objectify the break and set it aside before "
            "returning to the signal line.",
        )

    if protocol in FREEFORM_PROTOCOLS:
        if kind in FREEFORM_ALLOWED:
            return None
        return Refusal(
            "not_in_protocol",
            f"{kind.value} is not part of the {protocol.value.upper()} "
            "transcript vocabulary.",
        )

    if protocol != Protocol.CRV:
        return Refusal(
            "not_in_protocol",
            f"Protocol {protocol.value} does not run structured sessions.",
        )

    if current_stage not in CRV_STAGES:
        return Refusal("no_stage", "Session has no active stage.")

    allowed = CRV_STAGE_ALLOWED[current_stage]
    if kind in allowed:
        # Ideogram decoding must run in order within Stage I.
        if kind == EventKind.IDEOGRAM_A and not _has_stage_event(
            events, 1, EventKind.IDEOGRAM
        ):
            return Refusal(
                "structure_order",
                "Objectify the ideogram before decoding its A component.",
            )
        if kind == EventKind.IDEOGRAM_B and not _has_stage_event(
            events, 1, EventKind.IDEOGRAM_A
        ):
            return Refusal(
                "structure_order",
                "Objectify the A component before the B component.",
            )
        return None

    for stage, kinds in CRV_STAGE_ALLOWED.items():
        if kind in kinds:
            direction = "ahead of" if stage > current_stage else "behind"
            return Refusal(
                "out_of_structure",
                f"{kind.value} is Stage {_roman(stage)} content, {direction} "
                f"the current Stage {_roman(current_stage)}. Stay in "
                "structure.",
            )
    return Refusal("unknown_kind", f"{kind.value} is not viewer content.")


def _has_stage_event(events: list[EventView], stage: int, kind: EventKind) -> bool:
    return any(e.stage == stage and e.kind == kind for e in events)


_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


def _roman(stage: int) -> str:
    return _ROMAN.get(stage, str(stage))
