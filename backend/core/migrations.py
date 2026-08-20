"""Startup migration runner.

Versioned migrations tracked in a schema_migrations table so the same
database file (SQLite) or server (Postgres via DATABASE_URL) upgrades in
place. Legacy prototype rows survive, see docs/research/METRICS.md.
"""

import hashlib
from datetime import datetime

from core.config.logger import logger
from core.models.rv import (
    AnalystReport,
    AuditLog,
    EventKind,
    RVSession,
    RVSessionStatus,
    SealedTarget,
    SessionEnvironment,
    TargetPool,
    Tasking,
    TranscriptEvent,
    utcnow,
)
from core.models.session import Role
from core.models.session import Session as LegacySession
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import selectinload
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

LEGACY_POOL_NAME = "Legacy Imports"


async def _migration_0001_create_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


def _sha256_of_b64(payload_b64: str) -> str:
    return hashlib.sha256(payload_b64.encode("utf-8")).hexdigest()


def _ms_between(start: datetime, then: datetime) -> int:
    return max(0, int((then - start).total_seconds() * 1000))


async def _migration_0002_import_legacy_sessions(engine: AsyncEngine) -> None:
    """Copy prototype Session/Chat/Drawing/SessionScore rows into the
    research model without touching the originals."""
    async with AsyncSession(engine, expire_on_commit=False) as db:
        statement = select(LegacySession).options(
            selectinload(LegacySession.chat),  # type: ignore[arg-type]
            selectinload(LegacySession.drawings),  # type: ignore[arg-type]
            selectinload(LegacySession.analysis),  # type: ignore[arg-type]
        )
        legacy_sessions = (await db.exec(statement)).all()
        if not legacy_sessions:
            return

        pool = TargetPool(
            name=LEGACY_POOL_NAME,
            description="Targets imported from prototype sessions.",
        )
        db.add(pool)
        await db.flush()

        for legacy in legacy_sessions:
            target = SealedTarget(
                pool_id=pool.id,
                payload_b64=legacy.target_image,
                payload_sha256=_sha256_of_b64(legacy.target_image or ""),
                title=f"Legacy target {str(legacy.id)[:8]}",
                source="legacy",
                sealed_at=legacy.created_at,
            )
            db.add(target)
            await db.flush()

            tasking = Tasking(
                target_id=target.id,
                environment=SessionEnvironment.MONITORED_AI,
                created_at=legacy.created_at,
                sealed_at=legacy.created_at,
            )
            db.add(tasking)
            await db.flush()

            session = RVSession(
                tasking_id=tasking.id,
                status=RVSessionStatus.ARCHIVED,
                current_stage=int(legacy.stage),
                monitor_mode=SessionEnvironment.MONITORED_AI,
                monitor_blind=False,
                started_at=legacy.created_at,
                locked_at=legacy.updated_at,
                source=f"legacy:{legacy.id}",
                created_at=legacy.created_at,
            )
            db.add(session)
            await db.flush()

            seq = 0
            entries: list[tuple[datetime, EventKind, int, dict]] = []
            for msg in legacy.chat:
                kind = (
                    EventKind.MONITOR_PROMPT
                    if msg.user == Role.MONITOR
                    else EventKind.VIEWER_NOTE
                )
                entries.append(
                    (msg.timestamp, kind, int(msg.stage), {"text": msg.text})
                )

            strokes_by_stage: dict[int, list[dict]] = {}
            for stroke in legacy.drawings:
                strokes_by_stage.setdefault(int(stroke.stage), []).append(
                    {
                        "prevX": stroke.prev_x,
                        "prevY": stroke.prev_y,
                        "x": stroke.x,
                        "y": stroke.y,
                        "color": stroke.color,
                    }
                )
            for stage, strokes in strokes_by_stage.items():
                entries.append(
                    (legacy.updated_at, EventKind.SKETCH, stage, {"strokes": strokes})
                )

            entries.sort(key=lambda item: item[0])
            for created_at, kind, stage, payload in entries:
                seq += 1
                db.add(
                    TranscriptEvent(
                        session_id=session.id,
                        seq=seq,
                        stage=stage,
                        kind=kind,
                        payload=payload,
                        created_at=created_at,
                        ms_since_start=_ms_between(legacy.created_at, created_at),
                    )
                )

            if legacy.analysis:
                db.add(
                    AnalystReport(
                        session_id=session.id,
                        model="legacy-prototype",
                        summary="Imported prototype composite analysis.",
                        correspondences=legacy.analysis.target_correlations,
                        advisory_score=legacy.analysis.composite_score,
                        created_at=legacy.analysis.created_at,
                    )
                )

            db.add(
                AuditLog(
                    action="legacy_session_imported",
                    entity_type="rv_session",
                    entity_id=str(session.id),
                    detail={"legacy_session_id": str(legacy.id)},
                )
            )

        await db.commit()
        logger.info(f"Imported {len(legacy_sessions)} legacy sessions")


async def _migration_0003_arv_pairs(engine: AsyncEngine) -> None:
    """Add arv_pairs and taskings.arv_pair_id on databases that already
    applied create_all before those objects existed."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        dialect = conn.dialect.name
        if dialect == "sqlite":
            result = await conn.execute(text("PRAGMA table_info(taskings)"))
            columns = {row[1] for row in result.fetchall()}
            if "arv_pair_id" not in columns:
                await conn.execute(
                    text("ALTER TABLE taskings ADD COLUMN arv_pair_id VARCHAR")
                )
        else:
            await conn.execute(
                text("ALTER TABLE taskings ADD COLUMN IF NOT EXISTS arv_pair_id UUID")
            )


async def _add_column(conn, table: str, column: str, sqlite_type: str, pg_type: str):
    dialect = conn.dialect.name
    if dialect == "sqlite":
        result = await conn.execute(text(f"PRAGMA table_info({table})"))
        columns = {row[1] for row in result.fetchall()}
        if column not in columns:
            await conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_type}")
            )
    else:
        await conn.execute(
            text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {pg_type}")
        )


async def _migration_0004_viewers_and_fom(engine: AsyncEngine) -> None:
    """Named viewers and May figure-of-merit columns on judgments."""
    from core.models.rv import Judgment, RVSession, Viewer
    from services import scoring
    from sqlmodel import select
    from sqlmodel.ext.asyncio.session import AsyncSession

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await _add_column(conn, "rv_sessions", "viewer_id", "VARCHAR", "UUID")
        await _add_column(
            conn, "judgments", "accuracy", "FLOAT DEFAULT 0", "DOUBLE PRECISION"
        )
        await _add_column(
            conn, "judgments", "reliability", "FLOAT DEFAULT 0", "DOUBLE PRECISION"
        )
        await _add_column(
            conn,
            "judgments",
            "figure_of_merit",
            "FLOAT DEFAULT 0",
            "DOUBLE PRECISION",
        )

    async with AsyncSession(engine, expire_on_commit=False) as db:
        sessions = list((await db.exec(select(RVSession))).all())
        by_name: dict[str, Viewer] = {}
        for session in sessions:
            name = session.viewer_name or "Viewer 001"
            viewer = by_name.get(name)
            if viewer is None:
                existing = (
                    await db.exec(select(Viewer).where(Viewer.callsign == name))
                ).first()
                if existing is None:
                    existing = Viewer(callsign=name)
                    db.add(existing)
                    await db.flush()
                by_name[name] = existing
                viewer = existing
            if session.viewer_id is None:
                session.viewer_id = viewer.id
                db.add(session)

        judgments = list((await db.exec(select(Judgment))).all())
        for judgment in judgments:
            if judgment.figure_of_merit:
                continue
            judgment.accuracy = scoring.graded_accuracy(
                judgment.rank_of_true_target, judgment.pool_size
            )
            judgment.reliability = 1.0
            judgment.figure_of_merit = scoring.figure_of_merit(
                judgment.accuracy, judgment.reliability
            )
            db.add(judgment)
        await db.commit()


MIGRATIONS = [
    (1, "create research schema", _migration_0001_create_schema),
    (2, "import legacy prototype sessions", _migration_0002_import_legacy_sessions),
    (3, "arv pairs and tasking associate binding", _migration_0003_arv_pairs),
    (4, "viewers and May figure of merit", _migration_0004_viewers_and_fom),
]


async def run_migrations(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version INTEGER PRIMARY KEY, "
                "name VARCHAR NOT NULL, "
                "applied_at TIMESTAMP NOT NULL)"
            )
        )
        result = await conn.execute(text("SELECT version FROM schema_migrations"))
        applied = {row[0] for row in result.fetchall()}

    for version, name, migration in MIGRATIONS:
        if version in applied:
            continue
        logger.info(f"Applying migration {version}: {name}")
        await migration(engine)
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO schema_migrations (version, name, applied_at) "
                    "VALUES (:version, :name, :applied_at)"
                ),
                {"version": version, "name": name, "applied_at": utcnow()},
            )
