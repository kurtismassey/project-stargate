import os

import pytest
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.mark.asyncio
async def test_asyncpg_engine_constructs_without_connecting():
    import asyncpg

    engine = create_async_engine("postgresql+asyncpg://u:p@127.0.0.1/stargate")
    try:
        assert asyncpg.__name__ == "asyncpg"
        assert engine.url.get_backend_name() == "postgresql"
        assert engine.url.get_driver_name() == "asyncpg"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_postgres_round_trip_when_available():
    """Live asyncpg write when a Postgres server is actually listening.

    Point STARGATE_PG_TEST_URL at postgresql+asyncpg://... to require it
    (CI does). Without that, a missing server skips instead of failing
    the default SQLite suite.
    """
    explicit = os.environ.get("STARGATE_PG_TEST_URL")
    url = explicit or os.environ.get("DATABASE_URL", "")
    if not url.startswith("postgresql"):
        url = "postgresql+asyncpg://stargate:stargate@127.0.0.1:5432/stargate"

    engine = create_async_engine(url)
    try:
        from core.migrations import run_migrations
        from core.models.rv import Operator, TargetPool
        from services.auth import hash_passphrase, verify_passphrase
        from services.serializers import serialize_operator
        from sqlalchemy import text
        from sqlmodel.ext.asyncio.session import AsyncSession

        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))

        await run_migrations(engine)
        async with AsyncSession(engine, expire_on_commit=False) as db:
            pool = TargetPool(name="pg-probe", description="live driver")
            operator = Operator(
                callsign="PG-Op",
                passphrase_hash=hash_passphrase("pg-secret"),
            )
            db.add(pool)
            db.add(operator)
            await db.commit()
            await db.refresh(pool)
            await db.refresh(operator)
            public = serialize_operator(operator)
            assert public["callsign"] == "PG-Op"
            assert public["locked"] is True
            assert "passphrase" not in public
            assert verify_passphrase("pg-secret", operator.passphrase_hash)
            assert pool.name == "pg-probe"
            await db.delete(operator)
            await db.delete(pool)
            await db.commit()
    except Exception as error:
        if explicit:
            raise
        pytest.skip(f"Postgres not listening ({error.__class__.__name__})")
    finally:
        await engine.dispose()
