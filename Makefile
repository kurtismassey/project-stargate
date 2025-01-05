.PHONY: install start-websocket start-frontend start-web-app format lint test clean

install:
	poetry install
	poetry run pip install --upgrade pip

activate:
	poetry shell

start-websocket:
	poetry run uvicorn core.websocket.app:app --host 0.0.0.0 --port 8000 --reload

start-frontend:
	cd core/web && npm install && npm run dev

start-web-app: install
	$(MAKE) start-frontend &
	$(MAKE) start-websocket

format:
	poetry run ruff check --fix-only --unsafe-fixes core/
	poetry run ruff format core/

lint:
	poetry run mypy core/
	poetry run ruff check core/

test:
	poetry run pytest tests/ -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name "*.egg" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +