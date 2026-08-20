"""Associative remote viewing end to end.

Classic lab ARV seals two photograph associates and tasks the viewer on
the future feedback photo. Judging is binary rank-order of the two
sides. Pre-lock payloads never reveal which side is true.
"""

import asyncio
import json

from tests.test_blindness import _assert_sealed, _fetch_sealed_targets


def make_arv_session(client, environment="monitored_ai"):
    tasking = client.post(
        "/api/taskings", json={"protocol": "arv", "environment": environment}
    ).json()
    session = client.post("/api/sessions", json={"taskingId": tasking["id"]}).json()
    return tasking, session


class TestARVTasking:
    def test_arv_tasking_binds_a_pair(self, client):
        tasking = client.post("/api/taskings", json={"protocol": "arv"}).json()
        assert tasking["protocol"] == "arv"
        assert tasking["arvPairId"]
        assert tasking["cue"] == tasking["taskingNumber"]

    def test_arv_tasking_never_leaks_associates(self, client):
        tasking_response = client.post("/api/taskings", json={"protocol": "arv"})
        session_response = client.post(
            "/api/sessions", json={"taskingId": tasking_response.json()["id"]}
        )
        session_id = session_response.json()["id"]
        targets = _fetch_sealed_targets()
        assert targets

        prelock = {
            "POST /api/taskings": tasking_response.text,
            "GET /api/taskings": client.get("/api/taskings").text,
            "POST /api/sessions": session_response.text,
            "GET /api/sessions/{id}": client.get(f"/api/sessions/{session_id}").text,
        }
        for context, text in prelock.items():
            _assert_sealed(text, targets, context)
            assert '"labelA"' not in text
            assert '"label_a"' not in text


class TestARVSession:
    def test_arv_has_no_stage(self, client):
        _, session = make_arv_session(client)
        assert session["currentStage"] is None

    def test_arv_accepts_freeform_and_refuses_ideogram(self, client):
        _, session = make_arv_session(client)
        ok = client.post(
            f"/api/sessions/{session['id']}/events",
            json={"kind": "sensory", "payload": {"text": "blue, wet"}},
        )
        assert ok.status_code == 201
        refused = client.post(
            f"/api/sessions/{session['id']}/events",
            json={"kind": "ideogram", "payload": {}},
        )
        assert refused.status_code == 422
        assert refused.json()["detail"]["code"] == "not_in_protocol"

    def test_arv_opening_patter_names_feedback_photograph(self, client):
        _, session = make_arv_session(client)
        detail = client.get(f"/api/sessions/{session['id']}").json()
        prompts = [
            e["payload"]["text"]
            for e in detail["events"]
            if e["kind"] == "monitor_prompt"
        ]
        assert prompts
        assert "photograph you will see at feedback" in prompts[0]
        assert "Stage I" not in prompts[0]
        assert "ideogram" not in prompts[0]


class TestARVJudging:
    def test_judging_pool_is_the_two_associates(self, client):
        _, session = make_arv_session(client)
        client.post(f"/api/sessions/{session['id']}/lock")
        pool = client.get(f"/api/sessions/{session['id']}/judging-pool").json()["pool"]
        assert len(pool) == 2
        ids = {member["id"] for member in pool}
        assert len(ids) == 2
        member_text = json.dumps(pool)
        assert "title" not in member_text.lower() or all(
            "title" not in member for member in pool
        )
        assert all("isTrue" not in member for member in pool)

    def test_binary_hit_and_miss(self, client):
        _, session = make_arv_session(client)
        session_id = session["id"]
        client.post(f"/api/sessions/{session_id}/lock")
        pool = client.get(f"/api/sessions/{session_id}/judging-pool").json()["pool"]

        async def _true_id():
            from core.db import engine
            from core.models.rv import RVSession, Tasking
            from sqlmodel.ext.asyncio.session import AsyncSession

            async with AsyncSession(engine) as db:
                row = await db.get(RVSession, __import__("uuid").UUID(session_id))
                assert row is not None
                tasking = await db.get(Tasking, row.tasking_id)
                assert tasking is not None
                return str(tasking.target_id)

        true_id = asyncio.run(_true_id())
        other_id = next(m["id"] for m in pool if m["id"] != true_id)

        hit = client.post(
            f"/api/sessions/{session_id}/judgments",
            json={
                "rankings": [
                    {"targetId": true_id, "rank": 1},
                    {"targetId": other_id, "rank": 2},
                ]
            },
        )
        assert hit.status_code == 201
        assert hit.json()["rankOfTrueTarget"] == 1
        assert hit.json()["poolSize"] == 2

    def test_binary_miss(self, client):
        _, session = make_arv_session(client)
        session_id = session["id"]
        client.post(f"/api/sessions/{session_id}/lock")
        pool = client.get(f"/api/sessions/{session_id}/judging-pool").json()["pool"]

        async def _true_id():
            from uuid import UUID

            from core.db import engine
            from core.models.rv import RVSession, Tasking
            from sqlmodel.ext.asyncio.session import AsyncSession

            async with AsyncSession(engine) as db:
                row = await db.get(RVSession, UUID(session_id))
                assert row is not None
                tasking = await db.get(Tasking, row.tasking_id)
                assert tasking is not None
                return str(tasking.target_id)

        true_id = asyncio.run(_true_id())
        other_id = next(m["id"] for m in pool if m["id"] != true_id)
        miss = client.post(
            f"/api/sessions/{session_id}/judgments",
            json={
                "rankings": [
                    {"targetId": other_id, "rank": 1},
                    {"targetId": true_id, "rank": 2},
                ]
            },
        )
        assert miss.status_code == 201
        assert miss.json()["rankOfTrueTarget"] == 2
