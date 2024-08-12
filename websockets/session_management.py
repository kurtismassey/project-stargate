import os
import json
from fastapi import WebSocket
from google.cloud import storage
import base64

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
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(os.getenv("STORAGE_BUCKET"))
    blobs = list(bucket.list_blobs(prefix=f'sessions/{session_id}/targetImages'))
    
    latest_image_base64 = None
    if blobs:
        latest_blob = max(blobs, key=lambda x: x.time_created)
        image_bytes = latest_blob.download_as_bytes()
        latest_image_base64 = base64.b64encode(image_bytes).decode('utf-8')

    await websocket.send_text(json.dumps({
        "type": "initialHistory",
        "history": initial_history,
        "currentStage": current_stage,
        "latestTargetImage": latest_image_base64
    }))