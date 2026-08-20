"""Pure state machine tests for the CRV protocol rules."""

from core.models.rv import EventKind, Protocol
from services.protocol import (
    EventView,
    can_advance_stage,
    open_aol,
    stage_one_complete,
    validate_event,
)


def ev(kind: EventKind, stage: int | None = 1) -> EventView:
    return EventView(kind=kind, stage=stage)


class TestStageOneGating:
    def test_sensory_refused_in_stage_one(self):
        refusal = validate_event(Protocol.CRV, 1, EventKind.SENSORY, [])
        assert refusal is not None
        assert refusal.code == "out_of_structure"

    def test_ideogram_allowed_in_stage_one(self):
        assert validate_event(Protocol.CRV, 1, EventKind.IDEOGRAM, []) is None

    def test_a_component_requires_ideogram(self):
        refusal = validate_event(Protocol.CRV, 1, EventKind.IDEOGRAM_A, [])
        assert refusal is not None
        assert refusal.code == "structure_order"

    def test_b_component_requires_a_component(self):
        events = [ev(EventKind.IDEOGRAM)]
        refusal = validate_event(Protocol.CRV, 1, EventKind.IDEOGRAM_B, events)
        assert refusal is not None
        assert refusal.code == "structure_order"

    def test_full_trio_in_order(self):
        events: list[EventView] = []
        for kind in (EventKind.IDEOGRAM, EventKind.IDEOGRAM_A, EventKind.IDEOGRAM_B):
            assert validate_event(Protocol.CRV, 1, kind, events) is None
            events.append(ev(kind))
        assert stage_one_complete(events)


class TestStageAdvance:
    def test_cannot_advance_without_ideogram_trio(self):
        refusal = can_advance_stage(1, [ev(EventKind.IDEOGRAM)])
        assert refusal is not None
        assert refusal.code == "stage_one_incomplete"

    def test_advance_after_trio(self):
        events = [
            ev(EventKind.IDEOGRAM),
            ev(EventKind.IDEOGRAM_A),
            ev(EventKind.IDEOGRAM_B),
        ]
        assert can_advance_stage(1, events) is None

    def test_stage_two_requires_sensory_to_advance(self):
        events = [
            ev(EventKind.IDEOGRAM),
            ev(EventKind.IDEOGRAM_A),
            ev(EventKind.IDEOGRAM_B),
        ]
        refusal = can_advance_stage(2, events)
        assert refusal is not None
        assert refusal.code == "stage_incomplete"

        events.append(ev(EventKind.SENSORY, stage=2))
        assert can_advance_stage(2, events) is None

    def test_no_advance_past_stage_six(self):
        refusal = can_advance_stage(6, [])
        assert refusal is not None
        assert refusal.code == "last_stage"

    def test_no_advance_with_open_aol(self):
        events = [
            ev(EventKind.IDEOGRAM),
            ev(EventKind.IDEOGRAM_A),
            ev(EventKind.IDEOGRAM_B),
            ev(EventKind.AOL),
        ]
        refusal = can_advance_stage(1, events)
        assert refusal is not None
        assert refusal.code == "aol_open"


class TestAOLGating:
    def test_open_aol_detection(self):
        assert open_aol([ev(EventKind.AOL)])
        assert not open_aol([ev(EventKind.AOL), ev(EventKind.AOL_BREAK)])
        assert open_aol([ev(EventKind.AOL), ev(EventKind.AOL_BREAK), ev(EventKind.AOL)])

    def test_signal_refused_while_aol_open(self):
        events = [
            ev(EventKind.IDEOGRAM),
            ev(EventKind.IDEOGRAM_A),
            ev(EventKind.IDEOGRAM_B),
            ev(EventKind.AOL),
        ]
        refusal = validate_event(Protocol.CRV, 1, EventKind.IDEOGRAM, events)
        assert refusal is not None
        assert refusal.code == "aol_open"

    def test_aol_break_always_allowed(self):
        events = [ev(EventKind.AOL)]
        assert validate_event(Protocol.CRV, 1, EventKind.AOL_BREAK, events) is None

    def test_signal_allowed_after_aol_break(self):
        events = [ev(EventKind.AOL), ev(EventKind.AOL_BREAK)]
        assert validate_event(Protocol.CRV, 1, EventKind.IDEOGRAM, events) is None


class TestStageVocabulary:
    def test_stage_two_accepts_sensory(self):
        assert validate_event(Protocol.CRV, 2, EventKind.SENSORY, []) is None

    def test_stage_two_refuses_stage_four_matrix_content(self):
        refusal = validate_event(Protocol.CRV, 2, EventKind.INTANGIBLE, [])
        assert refusal is not None
        assert refusal.code == "out_of_structure"

    def test_stage_four_accepts_matrix_columns(self):
        for kind in (
            EventKind.SENSORY,
            EventKind.DIMENSIONAL,
            EventKind.EMOTIONAL_IMPACT,
            EventKind.TANGIBLE,
            EventKind.INTANGIBLE,
            EventKind.AOL_SIGNAL,
        ):
            assert validate_event(Protocol.CRV, 4, kind, []) is None

    def test_viewer_note_allowed_everywhere(self):
        for stage in range(1, 7):
            assert (
                validate_event(Protocol.CRV, stage, EventKind.VIEWER_NOTE, []) is None
            )


class TestERV:
    def test_erv_has_no_stage_gating(self):
        assert validate_event(Protocol.ERV, None, EventKind.SENSORY, []) is None
        assert validate_event(Protocol.ERV, None, EventKind.SKETCH, []) is None

    def test_erv_refuses_crv_structure_kinds(self):
        refusal = validate_event(Protocol.ERV, None, EventKind.IDEOGRAM, [])
        assert refusal is not None
        assert refusal.code == "not_in_protocol"

    def test_erv_still_gates_on_open_aol(self):
        events = [EventView(kind=EventKind.AOL, stage=None)]
        refusal = validate_event(Protocol.ERV, None, EventKind.SENSORY, events)
        assert refusal is not None
        assert refusal.code == "aol_open"


class TestARVAndWRV:
    def test_arv_uses_freeform_vocabulary(self):
        assert validate_event(Protocol.ARV, None, EventKind.SENSORY, []) is None
        assert validate_event(Protocol.ARV, None, EventKind.VIEWER_NOTE, []) is None
        refusal = validate_event(Protocol.ARV, None, EventKind.IDEOGRAM, [])
        assert refusal is not None
        assert refusal.code == "not_in_protocol"

    def test_wrv_uses_freeform_vocabulary(self):
        assert validate_event(Protocol.WRV, None, EventKind.VIEWER_NOTE, []) is None
        assert validate_event(Protocol.WRV, None, EventKind.SENSORY, []) is None
        refusal = validate_event(Protocol.WRV, None, EventKind.IDEOGRAM, [])
        assert refusal is not None
        assert refusal.code == "not_in_protocol"

    def test_arv_still_gates_on_open_aol(self):
        events = [EventView(kind=EventKind.AOL, stage=None)]
        refusal = validate_event(Protocol.ARV, None, EventKind.SENSORY, events)
        assert refusal is not None
        assert refusal.code == "aol_open"
