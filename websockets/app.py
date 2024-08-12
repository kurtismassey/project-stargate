import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_firestore import FirestoreChatMessageHistory
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel

from session_management import handle_session_join, broadcast_to_session, update_stage, connected_clients
from chat_management import process_chat, process_sketch_and_chat

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro")

vertexai.init(project=os.getenv("GOOGLE_CLOUD_PROJECT"), location="us-central1")
imagen_model = ImageGenerationModel.from_pretrained("imagegeneration@005")

chat_events = ["joinSession", "chatOnly", "sketchAndChat"]

@app.websocket("/session")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = None
    try:
        while True:
            data = await websocket.receive_text()
            data = json.loads(data)
            session_id = data.get("sessionId")

            if session_id is None:
                await websocket.close(code=1008, reason="Session ID is required")
                return

            if session_id not in connected_clients:
                connected_clients[session_id] = {
                    "clients": set(),
                    "stage": 1
                }
            connected_clients[session_id]["clients"].add(websocket)

            chat_history = []
            if data["type"] in chat_events:
                chat_history = FirestoreChatMessageHistory(
                    session_id=session_id, collection="RVSessionChats"
                )

            match data["type"]:
                case "joinSession":
                    await handle_session_join(chat_history, websocket, session_id)
                case "draw":
                    current_stage = connected_clients[session_id]["stage"]
                    data["stageNumber"] = current_stage
                    await broadcast_to_session(session_id, data, exclude=websocket)
                case "clear":
                    await broadcast_to_session(session_id, {"type": "clear"})
                case "syncStage":
                    await update_stage(session_id, data["stageNumber"])
                case "chatOnly":
                    await process_chat(data, session_id, chat_history, websocket, llm)
                case "sketchAndChat":
                    await process_sketch_and_chat(data, session_id, chat_history, websocket, llm, imagen_model)
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as error:
        print(f"Error in WebSocket connection: {str(error)}")
        await websocket.send_text(json.dumps({"type": "error", "message": str(error)}))
    finally:
        if session_id and session_id in connected_clients:
            connected_clients[session_id]["clients"].remove(websocket)
            if not connected_clients[session_id]["clients"]:
                del connected_clients[session_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)