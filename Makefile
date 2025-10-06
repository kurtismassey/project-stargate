install:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-install" "$(MAKE) frontend-install"

backend-install:
	@echo "Installing backend..."
	@poetry install

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
	@cd backend && PYTHONPATH=. poetry run fastapi dev app.py

format:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-format" "$(MAKE) frontend-format"

backend-format:
	@echo "Formatting backend..."
	@poetry run ruff check backend/
	@poetry run ruff format backend/

frontend-format:
	@echo "Formatting frontend..."
	@cd frontend && npm run format

lint:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-lint" "$(MAKE) frontend-lint"

backend-lint:
	@echo "Linting backend..."
	@poetry run ruff check backend/
	@poetry run mypy backend/

frontend-lint:
	@echo "Linting frontend..."
	@cd frontend && npm run lint

test:
	@npx concurrently -n backend,frontend -c "blue,green" "$(MAKE) backend-test" "$(MAKE) frontend-test"

backend-test:
	@cd backend && PYTHONPATH=. poetry run pytest tests/ -v

frontend-test:
	@cd frontend && npm run test