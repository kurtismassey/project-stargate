"""End-to-end May fuzzy FoM on a judged session."""

from services.descriptors import fuzzy_accuracy, fuzzy_reliability
from services.scoring import figure_of_merit


def test_judgment_uses_fuzzy_set_when_both_sides_encoded(client):
    vocab = client.get("/api/descriptors").json()["descriptors"]
    assert any(row["id"] == "water" for row in vocab)

    payload = (
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////"
        "////////////////////////////////////////////////2wBDAf//////////////////"
        "//////////////////////////////////////////////////////wAARCAABAAEDASIAAh"
        "EBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB"
        "AQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k="
    )
    created = client.post("/api/pools", json={"name": "FoM lake"}).json()
    sealed = client.post(
        f"/api/pools/{created['id']}/targets",
        json={
            "payloadB64": payload,
            "title": "Hidden Lake",
            "descriptors": {"water": 1, "mountain": 1},
        },
    )
    decoy = client.post(
        f"/api/pools/{created['id']}/targets",
        json={
            "payloadB64": payload,
            "title": "Decoy Yard",
            "descriptors": {"urban": 1, "vehicle": 1},
        },
    )
    assert sealed.status_code == 201
    assert decoy.status_code == 201
    detail = client.get(f"/api/pools/{created['id']}").json()
    assert all(row["encoded"] for row in detail["receipts"])
    assert "descriptors" not in detail
    assert "Hidden Lake" not in client.get(f"/api/pools/{created['id']}").text

    tasking = client.post("/api/taskings", json={"poolId": created["id"]}).json()
    session = client.post(
        "/api/sessions",
        json={"taskingId": tasking["id"], "viewerName": "McMoneagle"},
    ).json()
    session_id = session["id"]
    prelock = client.get(f"/api/sessions/{session_id}").text
    assert "descriptors" not in prelock
    assert "Hidden Lake" not in prelock
    client.post(
        f"/api/sessions/{session_id}/events",
        json={"kind": "ideogram", "payload": {"strokes": []}},
    )
    client.post(
        f"/api/sessions/{session_id}/events",
        json={
            "kind": "viewer_note",
            "payload": {"text": "cold water and a tall mountain"},
        },
    )
    blocked = client.get(f"/api/sessions/{session_id}/descriptor-suggestion")
    assert blocked.status_code == 403
    client.post(f"/api/sessions/{session_id}/lock")

    suggestion = client.get(f"/api/sessions/{session_id}/descriptor-suggestion").json()
    assert "water" in suggestion["descriptors"]
    assert "mountain" in suggestion["descriptors"]

    feedback = client.get(f"/api/sessions/{session_id}/feedback").json()
    target_encoding = feedback["target"]["descriptors"]
    response = {"water": 1.0, "mountain": 1.0}
    expected_accuracy = fuzzy_accuracy(target_encoding, response)
    expected_reliability = fuzzy_reliability(target_encoding, response)

    pool_members = client.get(f"/api/sessions/{session_id}/judging-pool").json()["pool"]
    rankings = [
        {"targetId": member["id"], "rank": index + 1}
        for index, member in enumerate(pool_members)
    ]
    judgment = client.post(
        f"/api/sessions/{session_id}/judgments",
        json={
            "rankings": rankings,
            "judgeName": "Judge 01",
            "responseDescriptors": response,
        },
    ).json()
    assert judgment["fomMethod"] == "fuzzy"
    assert judgment["accuracy"] == expected_accuracy
    assert judgment["reliability"] == expected_reliability
    assert judgment["figureOfMerit"] == figure_of_merit(
        expected_accuracy, expected_reliability
    )

    package = client.get(f"/api/sessions/{session_id}/package").json()
    assert package["judgment"]["fomMethod"] == "fuzzy"
    assert package["target"]["descriptors"]
    assert package["judgment"]["responseDescriptors"]["water"] == 1

    stats = client.get("/api/stats").json()
    assert stats["judging"]["byMethod"]["fuzzy"] >= 1
