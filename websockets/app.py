import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import asyncio
from typing import List, Dict
import base64
import tempfile
from pathlib import Path

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        self.active_connections[session_id].remove(websocket)
        if not self.active_connections[session_id]:
            del self.active_connections[session_id]

    async def broadcast(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data["type"] == "draw":
                await manager.broadcast(data, session_id)
            elif data["type"] == "clear":
                await manager.broadcast({"type": "clear"}, session_id)
            elif data["type"] == "chatOnly":
                await process_chat(data, session_id)
            elif data["type"] == "sketchAndChat":
                await process_sketch_and_chat(data, session_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)

async def process_chat(data: dict, session_id: str):
    message = data["message"]
    conversation_history = data["conversationHistory"]
    viewer_id = "#123"

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            system_instruction=f"You are a project monitor for Project Stargate, your assigned viewer is Viewer {viewer_id}. Use this to refer to them in any responses. You will guide the user through their remote viewing experience, you must be impartial and not lead the viewer in the conversation unless to gather further information."
        )

        chat_history = [
            {"role": "user" if msg["user"] == "Viewer" else "model", "parts": [msg["text"]]}
            for msg in conversation_history
        ]

        response = model.generate_content(
            [*chat_history, {"role": "user", "parts": [message]}],
            stream=True
        )

        full_response = ""
        for chunk in response:
            chunk_text = chunk.text
            full_response += chunk_text
            await manager.broadcast({
                "type": "geminiStreamResponse",
                "text": chunk_text,
                "user": "Monitor",
                "isComplete": False,
                "sessionId": session_id
            }, session_id)

        await manager.broadcast({
            "type": "geminiStreamResponse",
            "text": "",
            "user": "Monitor",
            "isComplete": True,
            "sessionId": session_id
        }, session_id)

    except Exception as e:
        print(f"Error querying Gemini: {e}")
        await manager.broadcast({
            "type": "geminiError",
            "message": "Error processing your request",
            "sessionId": session_id
        }, session_id)

async def process_sketch_and_chat(data: dict, session_id: str):
    message = data["message"]
    sketch_base64 = data["sketchArrayBuffer"]
    conversation_history = data["conversationHistory"]
    viewer_id = "#123"

    try:
        with tempfile.NamedTemporaryFile(suffix=".jpeg", delete=False) as temp_file:
            temp_file.write(base64.b64decode(sketch_base64))
            temp_file_path = temp_file.name

        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            system_instruction=f"You are a project monitor for Project Stargate, your assigned viewer is Viewer {viewer_id}. Use this to refer to them in any responses. You will guide the user through their remote viewing experience, you must be impartial and not lead the viewer in the conversation unless to gather further information. Analyze the provided sketch in your responses, commenting on what you perceive in the viewers sketch."
        )

        chat_history = [
            {"role": "user" if msg["user"] == "Viewer" else "model", "parts": [msg["text"]]}
            for msg in conversation_history
        ]

        with open(temp_file_path, "rb") as image_file:
            image_data = image_file.read()

        response = model.generate_content(
            [
                *chat_history,
                {
                    "role": "user",
                    "parts": [
                        message,
                        {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(image_data).decode()}}
                    ]
                }
            ],
            stream=True
        )

        full_response = ""
        for chunk in response:
            chunk_text = chunk.text
            full_response += chunk_text
            await manager.broadcast({
                "type": "geminiStreamResponse",
                "text": chunk_text,
                "user": "Monitor",
                "isComplete": False,
                "sessionId": session_id
            }, session_id)

        await manager.broadcast({
            "type": "geminiStreamResponse",
            "text": "",
            "user": "Monitor",
            "isComplete": True,
            "sessionId": session_id
        }, session_id)

    except Exception as e:
        print(f"Error querying Gemini: {e}")
        await manager.broadcast({
            "type": "geminiError",
            "message": "Error processing your request",
            "sessionId": session_id
        }, session_id)
    finally:
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)