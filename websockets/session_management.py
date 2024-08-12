import json
from fastapi import WebSocket

connected_clients = {}

async def broadcast_to_session(session_id: str, message: dict, exclude: WebSocket = None):
    if session_id in connected_clients:
        current_stage = connected_clients[session_id]["stage"]
        message["stageNumber"] = current_stage
        for client in connected_clients[session_id]["clients"]:
            if client != exclude:
                await client.send_text(json.dumps(message))

async def update_stage(session_id: str, new_stage: int):
    if session_id in connected_clients:
        connected_clients[session_id]["stage"] = new_stage
        await broadcast_to_session(session_id, {
            "type": "syncStage",
            "stageNumber": new_stage,
        })

async def handle_session_join(chat_history, websocket, session_id):
    initial_history = []
    for message in chat_history.messages:
        initial_history.append({
            "id": message.additional_kwargs.get("id"),
            "user": message.additional_kwargs.get("user"),
            "text": message.content,
            "timestamp": message.additional_kwargs.get("timestamp")
        })

    current_stage = connected_clients.get(session_id, {}).get("stage", 1)
    
    await websocket.send_text(json.dumps({
        "type": "initialHistory",
        "history": initial_history,
        "currentStage": current_stage
    }))