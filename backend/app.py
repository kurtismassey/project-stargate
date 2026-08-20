from contextlib import asynccontextmanager

from core.config.settings import settings
from core.db import engine
from core.migrations import run_migrations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import api_router, websocket_router
from services.session_engine import seed_default_pool
from sqlmodel.ext.asyncio.session import AsyncSession


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations(engine)
    async with AsyncSession(engine, expire_on_commit=False) as db:
        await seed_default_pool(db)
    yield


app = FastAPI(title="Project Stargate", lifespan=lifespan)

app.include_router(api_router)
app.include_router(websocket_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
