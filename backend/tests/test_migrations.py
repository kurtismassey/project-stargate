"""Legacy migration test.

Proves prototype Session/Chat/Drawing/SessionScore rows migrate into the
research model without dropping history.
"""

import asyncio
from uuid import uuid4


def test_legacy_sessions_import_without_loss(client):
    async def _run():
        from core.db import engine
        from core.migrations import _migration_0002_import_legacy_sessions
        from core.models.rv import (
            AnalystReport,
            RVSession,
            SealedTarget,
            Tasking,
            TranscriptEvent,
        )
        from core.models.scoring import SessionScore
        from core.models.session import ChatMessage, Drawing, Role
        from core.models.session import Session as LegacySession
        from core.models.session import Stage
        from sqlmodel import select
        from sqlmodel.ext.asyncio.session import AsyncSession

        legacy_id = uuid4()
        async with AsyncSession(engine, expire_on_commit=False) as db:
            db.add(
                LegacySession(
                    id=legacy_id,
                    target_image="bGVnYWN5LXRhcmdldC1ieXRlcw==",
                )
            )
            db.add(
                ChatMessage(
                    session_id=legacy_id,
                    user=Role.VIEWER,
                    text="I see water and a tall structure",
                    stage=Stage.STAGE_II,
                )
            )
            db.add(
                ChatMessage(
                    session_id=legacy_id,
                    user=Role.MONITOR,
                    text="Continue",
                    stage=Stage.STAGE_II,
                )
            )
            db.add(
                Drawing(
                    session_id=legacy_id,
                    stage=Stage.STAGE_III,
                    prev_x=0.1,
                    prev_y=0.1,
                    x=0.5,
                    y=0.5,
                    color="#000",
                )
            )
            await db.commit()
            db.add(
                SessionScore(
                    session_id=legacy_id,
                    overall_quality_score=4,
                    target_accuracy_score=3,
                    sensory_details_score=4,
                    dimensional_data_score=2,
                    emotional_energetic_score=3,
                    aol_contamination_score=2,
                    consistency_score=4,
                    stage_development_score=3,
                    composite_score=3.4,
                )
            )
            await db.commit()

        await _migration_0002_import_legacy_sessions(engine)

        async with AsyncSession(engine, expire_on_commit=False) as db:
            imported = (
                await db.exec(
                    select(RVSession).where(
                        RVSession.source == f"legacy:{legacy_id}"
                    )
                )
            ).one()
            assert imported.status.value == "archived"

            tasking = await db.get(Tasking, imported.tasking_id)
            target = await db.get(SealedTarget, tasking.target_id)
            assert target.payload_b64 == "bGVnYWN5LXRhcmdldC1ieXRlcw=="
            assert target.source == "legacy"

            events = (
                await db.exec(
                    select(TranscriptEvent).where(
                        TranscriptEvent.session_id == imported.id
                    )
                )
            ).all()
            kinds = sorted(e.kind.value for e in events)
            assert "viewer_note" in kinds
            assert "monitor_prompt" in kinds
            assert "sketch" in kinds

            report = (
                await db.exec(
                    select(AnalystReport).where(
                        AnalystReport.session_id == imported.id
                    )
                )
            ).one()
            assert report.advisory_score == 3.4

            # The legacy rows themselves survive untouched.
            legacy = await db.get(LegacySession, legacy_id)
            assert legacy is not None
            assert legacy.target_image == "bGVnYWN5LXRhcmdldC1ieXRlcw=="

    asyncio.run(_run())
