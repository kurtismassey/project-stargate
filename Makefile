install:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-install" "$(MAKE) frontend-install"

backend-install:
	@echo "Installing backend..."
	@uv sync

frontend-install:
	@echo "Installing frontend..."
	@cd frontend && npm install

dev:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-dev" "$(MAKE) frontend-dev"

frontend-dev:
	@echo "Starting frontend..."
	@cd frontend && npm run dev

backend-dev:
	@echo "Starting backend..."
	@cd backend && PYTHONPATH=. uv run fastapi dev app.py

format:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-format" "$(MAKE) frontend-format"

backend-format:
	@echo "Formatting backend..."
	@uv run ruff check backend/
	@uv run ruff format backend/

frontend-format:
	@echo "Formatting frontend..."
	@cd frontend && npm run format

lint:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-lint" "$(MAKE) frontend-lint"

backend-lint:
	@echo "Linting backend..."
	@uv run ruff check backend/
	@uv run mypy backend/

frontend-lint:
	@echo "Linting frontend..."
	@cd frontend && npm run lint

test:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-test" "$(MAKE) frontend-test"

backend-test:
	@cd backend && PYTHONPATH=. uv run pytest tests/ -v

frontend-test:
	@cd frontend && npm run test