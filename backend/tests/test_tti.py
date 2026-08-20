"""TTI instrumentation tests [TART-TTI].

Proves the schema records a sequential series, feedback latency, direct
hits via judging, and plus and minus one displacement scores.
"""


def make_series_with_trials(client, count=3):
    series = client.post("/api/series", json={"name": "TTI Alpha"}).json()
    sessions = []
    for _ in range(count):
        tasking = client.post("/api/taskings", json={"seriesId": series["id"]}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        sessions.append(session)
    return series, sessions


class TestSeries:
    def test_series_positions_are_sequential(self, client):
        _, sessions = make_series_with_trials(client, count=3)
        positions = [s["tasking"]["seriesPosition"] for s in sessions]
        assert positions == [1, 2, 3]

    def test_series_lists_tasking_count(self, client):
        series, _ = make_series_with_trials(client, count=3)
        listed = client.get("/api/series").json()["series"]
        entry = next(s for s in listed if s["id"] == series["id"])
        assert entry["taskingCount"] == 3


class TestJudging:
    def test_rank_order_judgment(self, client):
        _, sessions = make_series_with_trials(client, count=1)
        session_id = sessions[0]["id"]
        client.post(f"/api/sessions/{session_id}/lock")

        pool = client.get(f"/api/sessions/{session_id}/judging-pool").json()["pool"]
        rankings = [
            {"targetId": member["id"], "rank": index + 1}
            for index, member in enumerate(pool)
        ]
        judgment = client.post(
            f"/api/sessions/{session_id}/judgments",
            json={"rankings": rankings, "judgeName": "Judge 01"},
        )
        assert judgment.status_code == 201
        body = judgment.json()
        assert body["poolSize"] == 5
        assert 1 <= body["rankOfTrueTarget"] <= 5

        detail = client.get(f"/api/sessions/{session_id}").json()
        assert detail["status"] == "judged"

    def test_judgment_requires_full_permutation(self, client):
        _, sessions = make_series_with_trials(client, count=1)
        session_id = sessions[0]["id"]
        client.post(f"/api/sessions/{session_id}/lock")
        pool = client.get(f"/api/sessions/{session_id}/judging-pool").json()["pool"]
        bad = [{"targetId": m["id"], "rank": 1} for m in pool]
        response = client.post(
            f"/api/sessions/{session_id}/judgments", json={"rankings": bad}
        )
        assert response.status_code == 422


class TestDisplacement:
    def test_plus_and_minus_one_displacement_recorded(self, client):
        """A plus or minus one displacement can be recorded on a
        sequential series."""
        _, sessions = make_series_with_trials(client, count=3)
        middle = sessions[1]["id"]
        client.post(f"/api/sessions/{middle}/lock")

        plus_one = client.post(
            f"/api/sessions/{middle}/displacement",
            json={"lag": 1, "rank": 1, "poolSize": 5},
        )
        assert plus_one.status_code == 201
        assert plus_one.json()["isHit"] is True

        minus_one = client.post(
            f"/api/sessions/{middle}/displacement",
            json={"lag": -1, "rank": 3, "poolSize": 5},
        )
        assert minus_one.status_code == 201
        assert minus_one.json()["isHit"] is False

    def test_displacement_needs_existing_lag_trial(self, client):
        _, sessions = make_series_with_trials(client, count=1)
        only = sessions[0]["id"]
        client.post(f"/api/sessions/{only}/lock")
        response = client.post(
            f"/api/sessions/{only}/displacement",
            json={"lag": 1, "rank": 1, "poolSize": 5},
        )
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "no_lag_trial"

    def test_displacement_refused_outside_series(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        client.post(f"/api/sessions/{session['id']}/lock")
        response = client.post(
            f"/api/sessions/{session['id']}/displacement",
            json={"lag": 1, "rank": 1, "poolSize": 5},
        )
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "not_in_series"

    def test_displacement_refused_before_lock(self, client):
        _, sessions = make_series_with_trials(client, count=2)
        response = client.post(
            f"/api/sessions/{sessions[0]['id']}/displacement",
            json={"lag": 1, "rank": 1, "poolSize": 5},
        )
        assert response.status_code == 403

    def test_stats_aggregate_displacement(self, client):
        _, sessions = make_series_with_trials(client, count=2)
        first = sessions[0]["id"]
        client.post(f"/api/sessions/{first}/lock")
        client.post(
            f"/api/sessions/{first}/displacement",
            json={"lag": 1, "rank": 1, "poolSize": 5},
        )
        stats = client.get("/api/stats").json()
        assert stats["displacement"]["1"]["trials"] == 1
        assert stats["displacement"]["1"]["hits"] == 1
