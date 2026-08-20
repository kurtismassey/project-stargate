"""Chamber WebSocket.

Session state changes run over REST (routes/api.py) so the engine validates
everything in one place. The chamber socket does two jobs: relay live ink
strokes between windows watching the same session, and fan out committed
events and session updates that the REST handlers broadcast.

Ink frames are transient. The durable record is the committed sketch or
ideogram event, which carries the full stroke set.
"""

import asyncio
import json

from core.config.logger import logger
from core.connections import session_manager
from fastapi import WebSocket, WebSocketDisconnect

RELAYED_TYPES = {"ink", "ink_clear", "presence"}


async def _send_heartbeats(websocket: WebSocket) -> None:
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "heartbeat"}))
    except Exception:
        pass


async def _relay_frames(websocket: WebSocket, session_id: str) -> None:
    try:
        while True:
            data = await websocket.receive_text()
            try:
                frame = json.loads(data)
            except json.JSONDecodeError:
                continue
            if frame.get("type") in RELAYED_TYPES:
                await session_manager.broadcast(data, session_id, exclude=websocket)
    except WebSocketDisconnect:
        pass
    except Exception as error:
        logger.info(f"[Chamber {session_id}] relay error: {error}")


async def handle_chamber_socket(websocket: WebSocket, session_id: str) -> None:
    await session_manager.connect(websocket, session_id)
    await websocket.send_text(
        json.dumps({"type": "hello", "sessionId": session_id})
    )
    try:
        relay_task = asyncio.create_task(_relay_frames(websocket, session_id))
        heartbeat_task = asyncio.create_task(_send_heartbeats(websocket))
        await asyncio.wait(
            [relay_task, heartbeat_task], return_when=asyncio.FIRST_COMPLETED
        )
        relay_task.cancel()
        heartbeat_task.cancel()
    finally:
        session_manager.disconnect(websocket, session_id)
