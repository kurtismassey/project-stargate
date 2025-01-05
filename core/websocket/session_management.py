from fastapi import WebSocket
from langchain_google_firestore import FirestoreChatMessageHistory

connected_clients: dict[str, dict[str, set[WebSocket] | int]] = {}


async def handle_session_join(
    chat_history: FirestoreChatMessageHistory,
    websocket: WebSocket,
    session_id: str,
) -> None:
    """Handle a client joining a session."""
    await websocket.send_json(
        {
            "type": "sessionJoined",
            "sessionId": session_id,
            "history": [
                {
                    "content": msg.content,
                    "role": msg.type,
                    "timestamp": msg.additional_kwargs.get("timestamp", ""),
                }
                for msg in chat_history.messages
            ],
        }
    )


async def broadcast_to_session(
    session_id: str,
    message: dict,
    exclude: WebSocket | None = None,
) -> None:
    """Broadcast a message to all clients in a session."""
    if session_id in connected_clients:
        for client in connected_clients[session_id]["clients"]:
            if client != exclude:
                await client.send_json(message)


async def update_stage(session_id: str, stage: int) -> None:
    """Update the stage of a session."""
    if session_id in connected_clients:
        connected_clients[session_id]["stage"] = stage
        await broadcast_to_session(
            session_id,
            {"type": "stageUpdate", "stageNumber": stage},
        )
