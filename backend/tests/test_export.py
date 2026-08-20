"""Research package export and pool vault receipts [PAT-REPORT]."""

from tests.test_blindness import _assert_sealed, _fetch_sealed_targets


class TestPoolVault:
    def test_seal_receipt_hides_payload(self, client):
        pool = client.get("/api/pools").json()["pools"][0]
        # Tiny 1x1 JPEG
        payload = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k="
        sealed = client.post(
            f"/api/pools/{pool['id']}/targets",
            json={"payloadB64": payload, "title": "Secret Site Alpha"},
        )
        assert sealed.status_code == 201
        body = sealed.json()
        assert body["payloadSha256"]
        assert "payloadB64" not in body
        assert "title" not in body

        detail = client.get(f"/api/pools/{pool['id']}")
        assert detail.status_code == 200
        text = detail.text
        assert "Secret Site Alpha" not in text
        assert "payloadB64" not in text
        receipts = detail.json()["receipts"]
        match = next(
            row for row in receipts if row["payloadSha256"] == body["payloadSha256"]
        )
        assert match["encoded"] is False
        assert "descriptors" not in match

    def test_coordinate_site_needs_coordinates(self, client):
        pool = client.get("/api/pools").json()["pools"][0]
        response = client.post(
            f"/api/pools/{pool['id']}/targets",
            json={"kind": "coordinate_site", "title": "SCANATE"},
        )
        assert response.status_code == 422


class TestResearchPackage:
    def test_export_refused_before_lock(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        response = client.get(f"/api/sessions/{session['id']}/package")
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "not_locked"

    def test_export_after_lock_is_complete_and_hashed(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post(
            "/api/sessions", json={"taskingId": tasking["id"], "viewerName": "Price"}
        ).json()
        session_id = session["id"]
        client.post(
            f"/api/sessions/{session_id}/events",
            json={"kind": "ideogram", "payload": {"strokes": []}},
        )
        client.post(f"/api/sessions/{session_id}/lock")
        package = client.get(f"/api/sessions/{session_id}/package").json()
        assert package["kind"] == "session_package"
        assert package["viewer"] == "Price"
        assert package["taskingNumber"] == tasking["taskingNumber"]
        assert package["target"]["payloadSha256"]
        assert package["target"]["payloadB64"]
        kinds = [event["kind"] for event in package["events"]]
        assert "cue" in kinds
        assert "lock" in kinds

    def test_prelock_pool_list_stays_blind(self, client):
        client.post("/api/taskings", json={})
        targets = _fetch_sealed_targets()
        _assert_sealed(client.get("/api/pools").text, targets, "GET /api/pools")
        pool_id = client.get("/api/pools").json()["pools"][0]["id"]
        _assert_sealed(
            client.get(f"/api/pools/{pool_id}").text, targets, "GET /api/pools/{id}"
        )
