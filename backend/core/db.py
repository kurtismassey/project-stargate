from collections.abc import AsyncGenerator

from core.config.settings import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel.ext.asyncio.session import AsyncSession

_engine_kwargs: dict = {"echo": False}
if settings.DATABASE_URL.startswith("sqlite"):
    # No pooled connections for the local file database. Keeps event-loop
    # ownership simple for tests and dev reloads.
    _engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
