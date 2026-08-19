from core.config.logger import logger
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        logger.info(
            f"[Session {session_id}] WebSocket accepted, active connections for session: {len(self.active_connections[session_id])}"
        )

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            try:
                self.active_connections[session_id].remove(websocket)
                remaining_connections = len(self.active_connections[session_id])
                logger.info(
                    f"[Session {session_id}] WebSocket disconnected, remaining connections: {remaining_connections}"
                )
                if not self.active_connections[session_id]:
                    del self.active_connections[session_id]
                    logger.info(f"[Session {session_id}] No more active connections")
            except ValueError:
                pass

    async def broadcast(
        self, message: str, session_id: str, exclude: WebSocket | None = None
    ):
        if session_id not in self.active_connections:
            return

        disconnected_connections = []
        for connection in self.active_connections[session_id]:
            if connection is exclude:
                continue
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.info(f"Failed to send message to {connection}: {e}")
                disconnected_connections.append(connection)

        for connection in disconnected_connections:
            try:
                self.active_connections[session_id].remove(connection)
            except ValueError:
                pass


session_manager = ConnectionManager()
