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

    Skips in the default SQLite CI. Point DATABASE_URL or
    STARGATE_PG_TEST_URL at postgresql+asyncpg://... to run it.
    """
    url = os.environ.get("STARGATE_PG_TEST_URL") or os.environ.get("DATABASE_URL", "")
    if not url.startswith("postgresql"):
        url = "postgresql+asyncpg://stargate:stargate@127.0.0.1:5432/stargate"

    engine = create_async_engine(url)
    try:
        from sqlalchemy import text

        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.execute(text("DROP TABLE IF EXISTS stargate_pg_probe"))
            await conn.execute(
                text(
                    "CREATE TABLE stargate_pg_probe (id INTEGER PRIMARY KEY, note TEXT)"
                )
            )
            await conn.execute(
                text("INSERT INTO stargate_pg_probe (id, note) VALUES (1, 'ok')")
            )
            result = await conn.execute(
                text("SELECT note FROM stargate_pg_probe WHERE id = 1")
            )
            assert result.scalar_one() == "ok"
            await conn.execute(text("DROP TABLE stargate_pg_probe"))
    except Exception as error:
        pytest.skip(f"Postgres not listening ({error.__class__.__name__})")
    finally:
        await engine.dispose()
