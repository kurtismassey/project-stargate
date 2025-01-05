from uuid import UUID

from fastapi import WebSocket
from langchain_google_firestore import FirestoreChatMessageHistory

from ..ai.remote_viewing import RemoteViewingAIService
from ..config.settings import settings
from ..models.session import Session


class WebSocketManager:
    """Manager for WebSocket connections and session handling."""

    def __init__(self):
        self.connected_sessions: dict[str, dict[str, set[WebSocket] | int]] = {}
        self.ai_service = RemoteViewingAIService()

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        """Connect a client to a session."""
        if session_id not in self.connected_sessions:
            self.connected_sessions[session_id] = {"clients": set(), "stage": 1}
        self.connected_sessions[session_id]["clients"].add(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str) -> None:
        """Disconnect a client from a session."""
        if session_id in self.connected_sessions:
            self.connected_sessions[session_id]["clients"].remove(websocket)
            if not self.connected_sessions[session_id]["clients"]:
                del self.connected_sessions[session_id]

    async def broadcast_to_session(
        self, session_id: str, message: dict, exclude: WebSocket | None = None
    ) -> None:
        """Broadcast a message to all clients in a session."""
        if session_id in self.connected_sessions:
            for client in self.connected_sessions[session_id]["clients"]:
                if client != exclude:
                    await client.send_json(message)

    async def update_stage(self, session_id: str, stage: int) -> None:
        """Update the stage of a session."""
        if session_id in self.connected_sessions:
            self.connected_sessions[session_id]["stage"] = stage
            await self.broadcast_to_session(
                session_id, {"type": "stageUpdate", "stageNumber": stage}
            )

    def get_chat_history(self, session_id: str) -> FirestoreChatMessageHistory:
        """Get the chat history for a session."""
        return FirestoreChatMessageHistory(
            session_id=session_id, collection=settings.FIRESTORE_CHAT_COLLECTION
        )

    async def process_message(
        self, session_id: str, content: str, metadata: dict | None = None
    ) -> str:
        """Process a message using the AI service."""
        session = Session(
            id=UUID(session_id), user_id="system"
        )  # TODO: Add proper user handling
        message = session.add_message(content=content, metadata=metadata or {})
        return await self.ai_service.process_message(session, message)


websocket_manager = WebSocketManager()
