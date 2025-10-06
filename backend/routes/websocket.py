from fastapi import APIRouter, WebSocket
from services.websocket_service import (
    handle_websocket_session,
    handle_websocket_session_individual,
)

router = APIRouter(prefix="/ws")


@router.websocket("/session")
async def websocket_session(websocket: WebSocket):
    await handle_websocket_session(websocket)


@router.websocket("/session/{session_id}")
async def websocket_session_individual(websocket: WebSocket, session_id: str):
    await handle_websocket_session_individual(websocket, session_id)
