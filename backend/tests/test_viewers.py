"""Viewer roster and May FoM on judged sessions."""


def test_start_session_creates_named_viewer(client):
    tasking = client.post("/api/taskings", json={}).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"], "viewerName": "Hammid"},
    ).json()
    assert session["viewerName"] == "Hammid"
    assert session["viewerId"]

    viewers = client.get("/api/viewers").json()["viewers"]
    hammid = next(v for v in viewers if v["callsign"] == "Hammid")
    assert hammid["sessions"] == 1
    assert hammid["id"] == session["viewerId"]


def test_reuse_existing_viewer(client):
    created = client.post("/api/viewers", json={"callsign": "Price"}).json()
    tasking = client.post("/api/taskings", json={}).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"], "viewerId": created["id"]},
    ).json()
    assert session["viewerId"] == created["id"]
    assert session["viewerName"] == "Price"


def test_judgment_stores_figure_of_merit(client):
    tasking = client.post("/api/taskings", json={}).json()
    session = client.post(
        "/api/sessions", json={"taskingId": tasking["id"], "viewerName": "Swann"}
    ).json()
    session_id = session["id"]
    client.post(
        f"/api/sessions/{session_id}/events",
        json={"kind": "ideogram", "payload": {"strokes": []}},
    )
    client.post(f"/api/sessions/{session_id}/lock")
    pool = client.get(f"/api/sessions/{session_id}/judging-pool").json()["pool"]
    rankings = [
        {"targetId": member["id"], "rank": index + 1}
        for index, member in enumerate(pool)
    ]
    judgment = client.post(
        f"/api/sessions/{session_id}/judgments",
        json={"rankings": rankings, "judgeName": "Judge 01"},
    ).json()
    assert 0.0 < judgment["accuracy"] <= 1.0
    assert judgment["reliability"] == 1.0
    assert judgment["figureOfMerit"] == judgment["accuracy"] * judgment["reliability"]

    detail = client.get(f"/api/sessions/{session_id}").json()
    assert detail["judgment"]["figureOfMerit"] == judgment["figureOfMerit"]

    stats = client.get("/api/stats").json()
    assert "byProtocol" in stats["sessions"]
    assert "crv" in stats["sessions"]["byProtocol"]
    assert stats["judging"]["meanFigureOfMerit"] is not None
    swann = next(v for v in stats["viewers"] if v["callsign"] == "Swann")
    assert swann["judgedSessions"] == 1


def test_stats_stay_blind(client):
    from tests.test_blindness import _assert_sealed, _fetch_sealed_targets

    tasking = client.post("/api/taskings", json={}).json()
    client.post("/api/sessions", json={"taskingId": tasking["id"]})
    targets = _fetch_sealed_targets()
    _assert_sealed(client.get("/api/stats").text, targets, "GET /api/stats")
    _assert_sealed(client.get("/api/viewers").text, targets, "GET /api/viewers")
