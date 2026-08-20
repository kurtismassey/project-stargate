"""Named operators and a human monitor desk [CRV-MANUAL]."""


def test_create_operator_and_bind_on_session(client):
    operator = client.post("/api/operators", json={"callsign": "Puthoff"}).json()
    monitor = client.post("/api/operators", json={"callsign": "Swann"}).json()
    assert operator["callsign"] == "Puthoff"
    assert monitor["id"] != operator["id"]

    tasking = client.post("/api/taskings", json={"environment": "solo"}).json()
    session = client.post(
        "/api/sessions",
        json={
            "taskingId": tasking["id"],
            "viewerName": "Hammid",
            "operatorId": operator["id"],
            "monitorId": monitor["id"],
        },
    ).json()
    assert session["operatorName"] == "Puthoff"
    assert session["monitorName"] == "Swann"
    assert session["monitorMode"] == "monitored_human"
    assert session["monitorBlind"] is True

    roster = client.get("/api/operators").json()["operators"]
    puthoff = next(row for row in roster if row["callsign"] == "Puthoff")
    swann = next(row for row in roster if row["callsign"] == "Swann")
    assert puthoff["sessionsOperated"] == 1
    assert swann["sessionsMonitored"] == 1


def test_human_monitor_patter_reaches_transcript(client):
    monitor = client.post("/api/operators", json={"callsign": "Smith"}).json()
    tasking = client.post("/api/taskings", json={}).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"], "monitorId": monitor["id"]},
    ).json()
    session_id = session["id"]
    prompt = client.post(
        f"/api/sessions/{session_id}/monitor-prompts",
        json={"text": "Take the cue."},
    )
    assert prompt.status_code == 201
    event = prompt.json()["event"]
    assert event["kind"] == "monitor_prompt"
    assert event["payload"]["source"] == "human"
    assert event["payload"]["text"] == "Take the cue."

    detail = client.get(f"/api/sessions/{session_id}").json()
    texts = [
        row["payload"].get("text")
        for row in detail["events"]
        if row["kind"] == "monitor_prompt"
    ]
    assert "Take the cue." in texts


def test_leading_human_patter_is_refused(client):
    tasking = client.post("/api/taskings", json={}).json()
    session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
    response = client.post(
        f"/api/sessions/{session['id']}/monitor-prompts",
        json={"text": "Is it a mountain?"},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "leading_patter"

    detail = client.get(f"/api/sessions/{session['id']}").json()
    human = [
        row
        for row in detail["events"]
        if row["kind"] == "monitor_prompt" and row["payload"].get("source") == "human"
    ]
    assert human == []


def test_monitor_prompt_stays_open_without_lab_key(client, monkeypatch):
    from core.config.settings import settings

    monkeypatch.setattr(settings, "LAB_KEY", "rose-window")
    tasking = client.post(
        "/api/taskings", json={}, headers={"X-Lab-Key": "rose-window"}
    ).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"]},
        headers={"X-Lab-Key": "rose-window"},
    ).json()
    prompt = client.post(
        f"/api/sessions/{session['id']}/monitor-prompts",
        json={"text": "Objectify."},
    )
    assert prompt.status_code == 201


def test_monitor_fields_stay_off_target_material(client):
    from tests.test_blindness import _assert_sealed, _fetch_sealed_targets

    monitor = client.post("/api/operators", json={"callsign": "Price"}).json()
    tasking = client.post("/api/taskings", json={}).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"], "monitorId": monitor["id"]},
    ).json()
    targets = _fetch_sealed_targets()
    _assert_sealed(
        client.get(f"/api/sessions/{session['id']}").text,
        targets,
        "GET session with human monitor",
    )
    _assert_sealed(client.get("/api/operators").text, targets, "GET /api/operators")
