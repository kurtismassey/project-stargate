start-websocket:
	cd websockets && poetry install --no-root && poetry run uvicorn app:app --host 0.0.0.0 --port 8000 --reload

start-frontend:
	cd web_app && npm install && npm run dev

start-web-app:
	$(MAKE) start-frontend &
	$(MAKE) start-websocket