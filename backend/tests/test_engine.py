"""Session engine tests over the REST API.

Proves stage gating end to end: a session starts at Stage I, Stage II
cannot accept objectification before the Stage I ideogram exists, and the
lock is irreversible.
"""


def make_session(client, protocol="crv", environment="monitored_ai"):
    tasking = client.post(
        "/api/taskings", json={"protocol": protocol, "environment": environment}
    ).json()
    session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
    return session


def append(client, session_id, kind, payload=None):
    return client.post(
        f"/api/sessions/{session_id}/events",
        json={"kind": kind, "payload": payload or {}},
    )


def complete_stage_one(client, session_id):
    assert append(client, session_id, "ideogram", {"strokes": []}).status_code == 201
    assert (
        append(client, session_id, "ideogram_a", {"text": "rising, solid"}).status_code
        == 201
    )
    assert (
        append(client, session_id, "ideogram_b", {"text": "structure"}).status_code
        == 201
    )


class TestSessionLifecycle:
    def test_session_starts_at_stage_one(self, client):
        session = make_session(client)
        assert session["currentStage"] == 1
        assert session["status"] == "active"

    def test_cue_is_first_event(self, client):
        session = make_session(client)
        detail = client.get(f"/api/sessions/{session['id']}").json()
        assert detail["events"][0]["kind"] == "cue"
        assert detail["events"][0]["payload"]["cue"] == session["tasking"]["cue"]

    def test_one_session_per_tasking(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        first = client.post("/api/sessions", json={"taskingId": tasking["id"]})
        assert first.status_code == 201
        second = client.post("/api/sessions", json={"taskingId": tasking["id"]})
        assert second.status_code == 409


class TestStageGating:
    def test_stage_two_content_refused_before_ideogram(self, client):
        """Stage II cannot accept objectification before the Stage I
        ideogram exists."""
        session = make_session(client)
        response = append(client, session["id"], "sensory", {"text": "rough"})
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "out_of_structure"

    def test_advance_refused_before_ideogram_trio(self, client):
        session = make_session(client)
        response = client.post(f"/api/sessions/{session['id']}/advance")
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "stage_one_incomplete"

    def test_decode_order_enforced(self, client):
        session = make_session(client)
        response = append(client, session["id"], "ideogram_a", {"text": "rising"})
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "structure_order"

    def test_full_progression_to_stage_two(self, client):
        session = make_session(client)
        complete_stage_one(client, session["id"])
        advanced = client.post(f"/api/sessions/{session['id']}/advance")
        assert advanced.status_code == 200
        assert advanced.json()["currentStage"] == 2

        response = append(client, session["id"], "sensory", {"text": "cold, gray"})
        assert response.status_code == 201

    def test_stage_dwell_recorded_on_advance(self, client):
        session = make_session(client)
        complete_stage_one(client, session["id"])
        client.post(f"/api/sessions/{session['id']}/advance")
        detail = client.get(f"/api/sessions/{session['id']}").json()
        stages = {r["stage"]: r for r in detail["stageRecords"]}
        assert stages[1]["exitedAt"] is not None
        assert stages[1]["dwellMs"] is not None
        assert stages[2]["exitedAt"] is None


class TestAOLFlow:
    def test_aol_blocks_signal_until_break(self, client):
        session = make_session(client)
        assert append(client, session["id"], "ideogram", {}).status_code == 201
        assert (
            append(
                client, session["id"], "aol", {"text": "Golden Gate Bridge"}
            ).status_code
            == 201
        )

        blocked = append(client, session["id"], "ideogram_a", {"text": "rising"})
        assert blocked.status_code == 422
        assert blocked.json()["detail"]["code"] == "aol_open"

        assert append(client, session["id"], "aol_break", {}).status_code == 201
        assert (
            append(client, session["id"], "ideogram_a", {"text": "rising"}).status_code
            == 201
        )

    def test_aol_count_materialized(self, client):
        session = make_session(client)
        append(client, session["id"], "aol", {"text": "a bridge"})
        append(client, session["id"], "aol_break", {})
        append(client, session["id"], "aol", {"text": "a tower"})
        detail = client.get(f"/api/sessions/{session['id']}").json()
        assert detail["aolCount"] == 2

    def test_engine_monitor_responds_to_aol(self, client):
        session = make_session(client)
        result = append(client, session["id"], "aol", {"text": "a bridge"}).json()
        assert len(result["monitorEvents"]) == 1
        assert result["monitorEvents"][0]["kind"] == "monitor_prompt"
        assert result["monitorEvents"][0]["payload"]["source"] == "engine"

    def test_solo_environment_has_no_monitor_patter(self, client):
        session = make_session(client, environment="solo")
        result = append(client, session["id"], "aol", {"text": "a bridge"}).json()
        assert result["monitorEvents"] == []


class TestLock:
    def test_lock_closes_transcript(self, client):
        session = make_session(client)
        locked = client.post(f"/api/sessions/{session['id']}/lock")
        assert locked.status_code == 200
        assert locked.json()["status"] == "locked"

        refused = append(client, session["id"], "ideogram", {})
        assert refused.status_code == 409

    def test_lock_is_not_repeatable(self, client):
        session = make_session(client)
        client.post(f"/api/sessions/{session['id']}/lock")
        second = client.post(f"/api/sessions/{session['id']}/lock")
        assert second.status_code == 409


class TestERVSessions:
    def test_erv_session_has_no_stage(self, client):
        session = make_session(client, protocol="erv")
        assert session["currentStage"] is None
        assert (
            append(client, session["id"], "sensory", {"text": "warm"}).status_code
            == 201
        )

    def test_erv_refuses_ideogram(self, client):
        session = make_session(client, protocol="erv")
        response = append(client, session["id"], "ideogram", {})
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "not_in_protocol"

    def test_erv_refuses_stage_advance(self, client):
        session = make_session(client, protocol="erv")
        response = client.post(f"/api/sessions/{session['id']}/advance")
        assert response.status_code == 422
