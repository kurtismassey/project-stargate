import pytest
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.mark.asyncio
async def test_asyncpg_engine_constructs_without_connecting():
    import asyncpg

    engine = create_async_engine(
        "postgresql+asyncpg://u:p@127.0.0.1/stargate"
    )
    try:
        assert asyncpg.__name__ == "asyncpg"
        assert engine.url.get_backend_name() == "postgresql"
        assert engine.url.get_driver_name() == "asyncpg"
    finally:
        await engine.dispose()
