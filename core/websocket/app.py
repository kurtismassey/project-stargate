import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from langchain_google_vertexai import ChatVertexAI

from ..config.settings import settings
from .chat_management import complete_session, process_chat, process_sketch_and_chat
from .service import websocket_manager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatVertexAI(
    model_name=settings.VERTEX_AI_CHAT_MODEL,
    location=settings.VERTEX_AI_LOCATION,
)

chat_events = ["joinSession", "chatOnly", "sketchAndChat", "completeSession"]


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@app.websocket("/session")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for session management."""
    session_id = None
    try:
        await websocket.accept()

        data = await websocket.receive_text()
        data = json.loads(data)
        session_id = data.get("sessionId")

        if not session_id:
            await websocket.close(code=1008, reason="Session ID is required")
            return

        await websocket_manager.connect(websocket, session_id)

        while True:
            data = await websocket.receive_text()
            data = json.loads(data)

            chat_history = None
            if data["type"] in chat_events:
                chat_history = websocket_manager.get_chat_history(session_id)

            match data["type"]:
                case "joinSession":
                    await websocket_manager.handle_session_join(
                        chat_history, websocket, session_id
                    )
                case "draw":
                    current_stage = websocket_manager.connected_sessions[session_id][
                        "stage"
                    ]
                    data["stageNumber"] = current_stage
                    await websocket_manager.broadcast_to_session(
                        session_id, data, exclude=websocket
                    )
                case "clear":
                    await websocket_manager.broadcast_to_session(
                        session_id, {"type": "clear"}
                    )
                case "syncStage":
                    await websocket_manager.update_stage(
                        session_id, data["stageNumber"]
                    )
                case "chatOnly":
                    await process_chat(data, session_id, chat_history, websocket, llm)
                case "sketchAndChat":
                    await process_sketch_and_chat(
                        data, session_id, chat_history, websocket, llm, None
                    )
                case "completeSession":
                    try:
                        completion_data = await complete_session(
                            session_id, chat_history, llm
                        )
                        await websocket_manager.broadcast_to_session(
                            session_id,
                            {
                                "type": "sessionCompleted",
                                "summary": completion_data["summary"],
                                "details": completion_data["details"],
                            },
                        )
                    except Exception as e:
                        await websocket.send_json(
                            {
                                "type": "error",
                                "message": f"Failed to complete session: {e!s}",
                            }
                        )

    except WebSocketDisconnect:
        if session_id:
            websocket_manager.disconnect(websocket, session_id)
    except Exception as error:
        await websocket.send_json({"type": "error", "message": str(error)})
        if session_id:
            websocket_manager.disconnect(websocket, session_id)


def start() -> None:
    """Start the FastAPI application."""
    import uvicorn

    uvicorn.run(
        app,
        host=settings.WEBSOCKET_HOST,
        port=settings.WEBSOCKET_PORT,
    )
