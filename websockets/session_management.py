import os
import json
from fastapi import WebSocket
from google.cloud import storage
from google.cloud import firestore
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

    db = firestore.Client()
    session_ref = db.collection('sessions').document(session_id)
    session_data = session_ref.get().to_dict()

    current_stage = session_data.get('currentStage', 1)
    status = session_data.get('status', 'incomplete')
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(os.getenv("STORAGE_BUCKET"))
    
    latest_image_base64 = None
    target_image_path = None
    summary = None
    details = []

    if status == 'completed':
        target_image_path = session_data.get('targetImagePath')
        summary = session_data.get('summary')
        details = session_data.get('detailsList', {})
    else:
        blobs = list(bucket.list_blobs(prefix=f'sessions/{session_id}/targetModels'))
        if blobs:
            latest_blob = max(blobs, key=lambda x: x.time_created)
            image_bytes = latest_blob.download_as_bytes()
            latest_image_base64 = base64.b64encode(image_bytes).decode('utf-8')

    await websocket.send_text(json.dumps({
        "type": "initialHistory",
        "history": initial_history,
        "currentStage": current_stage,
        "status": status,
        "detailsList": details,
        "latestTargetImage": latest_image_base64,
        "completionData": {
            "targetImagePath": target_image_path,
            "summary": summary,
            "details": details
        } if status == 'completed' else None
    }))
