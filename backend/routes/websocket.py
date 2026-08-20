from fastapi import APIRouter, WebSocket
from services.websocket_service import handle_chamber_socket

router = APIRouter(prefix="/ws")


@router.websocket("/chamber/{session_id}")
async def chamber_socket(websocket: WebSocket, session_id: str):
    await handle_chamber_socket(websocket, session_id)
