import os

import pytest
from fastapi.testclient import TestClient

os.environ["GOOGLE_API_KEY"] = "test-api-key"


@pytest.fixture
def client():
    """
    Create test client
    """
    from app import app

    return TestClient(app)


def test_health_endpoint(client):
    """
    Test the health endpoint returns healthy status.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_root_endpoint(client):
    """
    Test the root endpoint returns the API name.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.text == "Project Stargate API"
