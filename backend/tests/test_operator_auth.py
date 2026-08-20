"""Per-operator passphrases close the ops desk. Chamber writes stay open."""

from core.config.settings import settings


def test_hash_round_trip():
    from services.auth import hash_passphrase, verify_passphrase

    stored = hash_passphrase("scanate-1972")
    assert stored.startswith("pbkdf2$")
    assert verify_passphrase("scanate-1972", stored) is True
    assert verify_passphrase("wrong", stored) is False


def test_first_passphrase_closes_the_desk(client):
    open_cut = client.post("/api/taskings", json={})
    assert open_cut.status_code == 201

    created = client.post(
        "/api/operators",
        json={"callsign": "Puthoff", "passphrase": "scanate-1972"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["callsign"] == "Puthoff"
    assert body["locked"] is True
    assert body["token"]
    assert "passphrase" not in body
    assert "passphraseHash" not in body
    assert "pbkdf2" not in created.text

    health = client.get("/api/health").json()
    assert health["operatorAuthRequired"] is True

    denied = client.post("/api/taskings", json={})
    assert denied.status_code == 401
    assert denied.json()["detail"]["code"] == "operator_token_required"

    allowed = client.post(
        "/api/taskings", json={}, headers={"X-Operator-Token": body["token"]}
    )
    assert allowed.status_code == 201

    session = client.post(
        "/api/sessions",
        json={"taskingId": allowed.json()["id"]},
        headers={"X-Operator-Token": body["token"]},
    )
    assert session.status_code == 201
    event = client.post(
        f"/api/sessions/{session.json()['id']}/events",
        json={"kind": "ideogram", "payload": {"strokes": []}},
    )
    assert event.status_code == 201


def test_sign_in_and_me(client):
    client.post(
        "/api/operators",
        json={"callsign": "Swann", "passphrase": "crv-manual"},
    )
    unknown = client.post(
        "/api/auth/operator",
        json={"callsign": "Price", "passphrase": "crv-manual"},
    )
    assert unknown.status_code == 401
    assert unknown.json()["detail"]["code"] == "unknown_operator"

    wrong = client.post(
        "/api/auth/operator",
        json={"callsign": "Swann", "passphrase": "wrong"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["detail"]["code"] == "bad_passphrase"

    signed = client.post(
        "/api/auth/operator",
        json={"callsign": "Swann", "passphrase": "crv-manual"},
    )
    assert signed.status_code == 200
    token = signed.json()["token"]
    assert signed.json()["operator"]["callsign"] == "Swann"
    assert "pbkdf2" not in signed.text

    me = client.get("/api/auth/me", headers={"X-Operator-Token": token})
    assert me.status_code == 200
    assert me.json()["operator"]["callsign"] == "Swann"
    assert me.json()["operator"]["locked"] is True

    stale = client.get("/api/auth/me")
    assert stale.status_code == 401


def test_unlocked_operator_cannot_sign_in(client):
    client.post("/api/operators", json={"callsign": "Hammid"})
    response = client.post(
        "/api/auth/operator",
        json={"callsign": "Hammid", "passphrase": ""},
    )
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "no_passphrase"
    still_open = client.post("/api/taskings", json={})
    assert still_open.status_code == 201


def test_operator_token_satisfies_lab_key(client, monkeypatch):
    created = client.post(
        "/api/operators",
        json={"callsign": "Ingo", "passphrase": "stage-one"},
    ).json()
    monkeypatch.setattr(settings, "LAB_KEY", "rose-window")
    denied = client.post("/api/taskings", json={})
    assert denied.status_code == 401
    by_key = client.post(
        "/api/taskings", json={}, headers={"X-Lab-Key": "rose-window"}
    )
    assert by_key.status_code == 201
    by_token = client.post(
        "/api/taskings",
        json={},
        headers={"X-Operator-Token": created["token"]},
    )
    assert by_token.status_code == 201


def test_hashes_and_tokens_stay_off_the_roster(client):
    from tests.test_blindness import _assert_sealed, _fetch_sealed_targets

    created = client.post(
        "/api/operators",
        json={"callsign": "Harary", "passphrase": "rose-window-secret"},
    ).json()
    roster = client.get("/api/operators")
    text = roster.text
    assert "rose-window-secret" not in text
    assert "pbkdf2" not in text
    assert created["token"] not in text
    row = roster.json()["operators"][0]
    assert row["locked"] is True
    assert "passphraseHash" not in row
    assert "token" not in row

    tasking = client.post(
        "/api/taskings",
        json={},
        headers={"X-Operator-Token": created["token"]},
    ).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"], "operatorId": created["id"]},
        headers={"X-Operator-Token": created["token"]},
    )
    targets = _fetch_sealed_targets()
    _assert_sealed(session.text, targets, "session after keyed operator")
    _assert_sealed(text, targets, "GET /api/operators keyed")
    assert "rose-window-secret" not in session.text
    assert "pbkdf2" not in session.text


def test_second_passphrase_on_same_callsign_is_refused(client):
    client.post(
        "/api/operators",
        json={"callsign": "Targ", "passphrase": "first"},
    )
    again = client.post(
        "/api/operators",
        json={"callsign": "Targ", "passphrase": "second"},
        headers={"X-Operator-Token": "not-a-token"},
    )
    # Desk is closed, so a bogus token is 401 before the 409.
    assert again.status_code == 401

    first = client.post(
        "/api/auth/operator",
        json={"callsign": "Targ", "passphrase": "first"},
    ).json()
    clash = client.post(
        "/api/operators",
        json={"callsign": "Targ", "passphrase": "second"},
        headers={"X-Operator-Token": first["token"]},
    )
    assert clash.status_code == 409
    assert clash.json()["detail"]["code"] == "already_locked"
