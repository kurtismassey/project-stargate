"""Closed-lab key gates mutating ops, not the chamber."""

from core.config.settings import settings


def test_lab_key_refuses_ops_without_header(client, monkeypatch):
    monkeypatch.setattr(settings, "LAB_KEY", "rose-window")

    health = client.get("/api/health").json()
    assert health["labKeyRequired"] is True

    denied = client.post("/api/taskings", json={})
    assert denied.status_code == 401
    assert denied.json()["detail"]["code"] == "lab_key_required"

    allowed = client.post(
        "/api/taskings", json={}, headers={"X-Lab-Key": "rose-window"}
    )
    assert allowed.status_code == 201
    session = client.post(
        "/api/sessions",
        json={"taskingId": allowed.json()["id"]},
        headers={"X-Lab-Key": "rose-window"},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]
    event = client.post(
        f"/api/sessions/{session_id}/events",
        json={"kind": "ideogram", "payload": {"strokes": []}},
    )
    assert event.status_code == 201
