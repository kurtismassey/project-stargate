"""Test fixtures.

A fresh SQLite file per test. The TestClient context manager runs the app
lifespan, so migrations and the default pool seed run exactly as they do
in dev.
"""

import os
import tempfile
from pathlib import Path

_TMPDIR = tempfile.mkdtemp(prefix="stargate-tests-")
_DB_PATH = Path(_TMPDIR) / "test.db"

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_PATH}"
# Force AI off so tests prove the session loop is independent of it.
os.environ["GOOGLE_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    if _DB_PATH.exists():
        _DB_PATH.unlink()

    from app import app

    with TestClient(app) as test_client:
        yield test_client
