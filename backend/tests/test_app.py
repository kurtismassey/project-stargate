class TestHealth:
    def test_health_endpoint(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["aiEnabled"] is False

    def test_default_pool_seeded(self, client):
        pools = client.get("/api/pools").json()["pools"]
        assert len(pools) >= 1
        assert pools[0]["targetCount"] > 0
