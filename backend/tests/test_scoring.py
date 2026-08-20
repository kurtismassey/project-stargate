"""May figure-of-merit calculations [MAY-FOM]."""

from core.models.rv import EventKind
from services.scoring import figure_of_merit, graded_accuracy, transcript_reliability


class TestGradedAccuracy:
    def test_first_place_is_one(self):
        assert graded_accuracy(1, 5) == 1.0
        assert graded_accuracy(1, 2) == 1.0

    def test_last_place_is_one_over_n(self):
        assert graded_accuracy(5, 5) == 0.2
        assert graded_accuracy(2, 2) == 0.5

    def test_middle_rank(self):
        assert graded_accuracy(3, 5) == 0.6

    def test_bad_rank_is_zero(self):
        assert graded_accuracy(0, 5) == 0.0
        assert graded_accuracy(6, 5) == 0.0


class TestReliability:
    def test_empty_transcript_is_zero(self):
        assert transcript_reliability([EventKind.CUE, EventKind.LOCK], 0) == 0.0

    def test_signal_without_aol_is_one(self):
        kinds = [EventKind.IDEOGRAM, EventKind.SENSORY, EventKind.SKETCH]
        assert transcript_reliability(kinds, 0) == 1.0

    def test_equal_aol_and_signal_is_half(self):
        kinds = [EventKind.SENSORY, EventKind.SENSORY]
        assert transcript_reliability(kinds, 2) == 0.5


class TestFigureOfMerit:
    def test_is_product(self):
        assert figure_of_merit(1.0, 0.5) == 0.5
        assert figure_of_merit(0.6, 1.0) == 0.6

    def test_clamps(self):
        assert figure_of_merit(2.0, 1.0) == 1.0
        assert figure_of_merit(-1.0, 1.0) == 0.0
