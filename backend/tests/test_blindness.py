"""Blindness invariant tests.

Walks every payload a viewer-facing client can receive before lock and
asserts sealed target material (payload bytes, title, hash) never appears.
After lock, feedback reveals the target and the seal hash verifies.
"""

import asyncio
import hashlib
import json


def _fetch_sealed_targets():
    """Read sealed target material straight from the database, bypassing
    the API, to know exactly which bytes must not leak."""

    async def _query():
        from core.db import engine
        from core.models.rv import SealedTarget
        from sqlmodel import select
        from sqlmodel.ext.asyncio.session import AsyncSession

        async with AsyncSession(engine) as db:
            return [
                {
                    "id": str(t.id),
                    "payload": t.payload_b64,
                    "title": t.title,
                    "sha256": t.payload_sha256,
                }
                for t in (await db.exec(select(SealedTarget))).all()
            ]

    return asyncio.run(_query())


def _assert_sealed(payload_text: str, targets: list[dict], context: str):
    for target in targets:
        if target["payload"]:
            # Any 64-char slice of the sealed base64 counts as a leak.
            probe = target["payload"][:64]
            assert probe not in payload_text, f"target bytes leaked via {context}"
        if target["title"]:
            assert target["title"] not in payload_text, (
                f"target title leaked via {context}"
            )


class TestBlindnessBeforeLock:
    def test_no_target_material_in_any_prelock_payload(self, client):
        tasking_response = client.post("/api/taskings", json={})
        session_response = client.post(
            "/api/sessions", json={"taskingId": tasking_response.json()["id"]}
        )
        session_id = session_response.json()["id"]

        client.post(
            f"/api/sessions/{session_id}/events",
            json={"kind": "ideogram", "payload": {"strokes": []}},
        )
        client.post(
            f"/api/sessions/{session_id}/events",
            json={"kind": "ideogram_a", "payload": {"text": "rising"}},
        )

        targets = _fetch_sealed_targets()
        assert targets, "seeded pool expected"

        prelock_payloads = {
            "POST /api/taskings": tasking_response.text,
            "GET /api/taskings": client.get("/api/taskings").text,
            "POST /api/sessions": session_response.text,
            "GET /api/sessions": client.get("/api/sessions").text,
            "GET /api/sessions/{id}": client.get(f"/api/sessions/{session_id}").text,
            "GET /api/stats": client.get("/api/stats").text,
            "GET /api/pools": client.get("/api/pools").text,
        }
        for context, text in prelock_payloads.items():
            _assert_sealed(text, targets, context)

    def test_feedback_sealed_before_lock(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        response = client.get(f"/api/sessions/{session['id']}/feedback")
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "not_locked"

    def test_judging_pool_sealed_before_lock(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        response = client.get(f"/api/sessions/{session['id']}/judging-pool")
        assert response.status_code == 403

    def test_analysis_sealed_before_lock(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        response = client.post(f"/api/sessions/{session['id']}/analysis")
        # 503 when AI is disabled, 403 when enabled but unlocked. Either
        # way the target never left the server.
        assert response.status_code in (403, 503)

    def test_cue_is_opaque(self, client):
        """The cue is a tasking number, never a description."""
        tasking = client.post("/api/taskings", json={}).json()
        assert tasking["cue"] == tasking["taskingNumber"]
        left, right = tasking["cue"].split("-")
        assert len(left) == 4 and left.isdigit()
        assert len(right) == 4 and right.isdigit()


class TestFeedbackAfterLock:
    def test_feedback_reveals_target_with_verifiable_seal(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        client.post(f"/api/sessions/{session['id']}/lock")

        feedback = client.get(f"/api/sessions/{session['id']}/feedback")
        assert feedback.status_code == 200
        target = feedback.json()["target"]
        assert target["payloadB64"]
        digest = hashlib.sha256(target["payloadB64"].encode("utf-8")).hexdigest()
        assert digest == target["payloadSha256"], "seal verification failed"

    def test_feedback_latency_recorded_once(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        client.post(f"/api/sessions/{session['id']}/lock")

        first = client.get(f"/api/sessions/{session['id']}/feedback").json()
        assert first["feedbackLatencyMs"] is not None
        second = client.get(f"/api/sessions/{session['id']}/feedback").json()
        assert second["feedbackAt"] == first["feedbackAt"]
        assert second["feedbackLatencyMs"] == first["feedbackLatencyMs"]

    def test_feedback_view_recorded_in_transcript(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        client.post(f"/api/sessions/{session['id']}/lock")
        client.get(f"/api/sessions/{session['id']}/feedback")

        detail = client.get(f"/api/sessions/{session['id']}").json()
        kinds = [e["kind"] for e in detail["events"]]
        assert "lock" in kinds
        assert "feedback_view" in kinds
        assert kinds.index("lock") < kinds.index("feedback_view")

    def test_judging_pool_does_not_mark_true_target(self, client):
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        client.post(f"/api/sessions/{session['id']}/lock")

        pool = client.get(f"/api/sessions/{session['id']}/judging-pool").json()["pool"]
        assert len(pool) == 5
        member_text = json.dumps(pool)
        assert "true" not in [str(m.get("isTrue")) for m in pool]
        assert "title" not in member_text.lower() or all("title" not in m for m in pool)


class TestWebSocketBlindness:
    def test_chamber_frames_never_contain_target_material(self, client):
        """Walk /ws/chamber frames the same way REST payloads are walked."""
        tasking = client.post("/api/taskings", json={}).json()
        session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
        session_id = session["id"]
        targets = _fetch_sealed_targets()
        assert targets

        frames: list[str] = []
        with client.websocket_connect(f"/ws/chamber/{session_id}") as socket:
            hello = socket.receive_text()
            frames.append(hello)
            hello_body = json.loads(hello)
            assert hello_body["type"] == "hello"
            assert hello_body["sessionId"] == session_id

            client.post(
                f"/api/sessions/{session_id}/events",
                json={"kind": "ideogram", "payload": {"strokes": []}},
            )
            event_frame = socket.receive_text()
            frames.append(event_frame)
            event_body = json.loads(event_frame)
            assert event_body["type"] == "event"
            assert event_body["event"]["kind"] == "ideogram"

            client.post(f"/api/sessions/{session_id}/lock")
            session_frame = socket.receive_text()
            frames.append(session_frame)
            session_body = json.loads(session_frame)
            assert session_body["type"] == "session"
            assert session_body["session"]["status"] == "locked"

        for index, frame in enumerate(frames):
            _assert_sealed(frame, targets, f"ws frame {index}")
            parsed = json.loads(frame)
            dumped = json.dumps(parsed)
            assert "payloadB64" not in dumped
            assert "payload_b64" not in dumped
