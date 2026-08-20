"""May fuzzy-set encodings [MAY-FOM]."""

from services.descriptors import (
    fuzzy_accuracy,
    fuzzy_reliability,
    has_mass,
    normalize,
    suggest_from_texts,
)
from services.scoring import FOM_FUZZY, FOM_RANK_PROCESS, official_scores
from core.models.rv import EventKind


class TestNormalize:
    def test_drops_unknown_and_zero(self):
        assert normalize({"water": 1, "bogus": 1, "land": 0}) == {"water": 1.0}

    def test_clamps_partial(self):
        assert normalize({"water": 0.7}) == {"water": 0.5}
        assert normalize({"water": 1.4}) == {"water": 1.0}


class TestFuzzySets:
    def test_perfect_match(self):
        target = {"water": 1, "mountain": 1}
        response = {"water": 1, "mountain": 1}
        assert fuzzy_accuracy(target, response) == 1.0
        assert fuzzy_reliability(target, response) == 1.0

    def test_accuracy_is_target_coverage(self):
        # Hit half the target. Extra response bits do not raise accuracy.
        target = {"water": 1, "mountain": 1}
        response = {"water": 1, "vehicle": 1}
        assert fuzzy_accuracy(target, response) == 0.5

    def test_reliability_is_response_correctness(self):
        target = {"water": 1, "mountain": 1}
        response = {"water": 1, "vehicle": 1}
        assert fuzzy_reliability(target, response) == 0.5

    def test_verbose_wrong_response_hurts_reliability(self):
        target = {"water": 1}
        response = {"water": 1, "vehicle": 1, "urban": 1, "military": 1}
        assert fuzzy_accuracy(target, response) == 1.0
        assert fuzzy_reliability(target, response) == 0.25

    def test_empty_is_zero(self):
        assert fuzzy_accuracy({}, {"water": 1}) == 0.0
        assert fuzzy_reliability({"water": 1}, {}) == 0.0
        assert not has_mass({})


class TestOfficialScores:
    def test_falls_back_to_rank_process(self):
        scores = official_scores(1, 5, [EventKind.SENSORY], 0, {}, {"water": 1})
        assert scores.method == FOM_RANK_PROCESS
        assert scores.accuracy == 1.0
        assert scores.reliability == 1.0

    def test_uses_fuzzy_when_both_encoded(self):
        scores = official_scores(
            5,
            5,
            [EventKind.SENSORY],
            0,
            {"water": 1, "mountain": 1},
            {"water": 1},
        )
        assert scores.method == FOM_FUZZY
        assert scores.accuracy == 0.5
        assert scores.reliability == 1.0
        assert scores.figure_of_merit == 0.5


class TestSuggestion:
    def test_reads_transcript_words(self):
        proposed = suggest_from_texts(
            ["tall vertical mountain peak", "cold water lake"]
        )
        assert proposed["mountain"] == 1.0
        assert proposed["water"] == 1.0
        assert proposed["vertical"] == 1.0
        assert proposed["cold"] == 0.5
