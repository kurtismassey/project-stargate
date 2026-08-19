from core.config.settings import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

engine = create_async_engine(settings.DATABASE_URL, echo=True)


async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
