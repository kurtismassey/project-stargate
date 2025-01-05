import uuid
from datetime import datetime
from typing import Any

from fastapi import WebSocket
from langchain.schema import SystemMessage
from langchain_google_firestore import FirestoreChatMessageHistory

from .prompts.sessions.core import SESSION_SYSTEM_PROMPT


async def process_chat(
    data: dict,
    session_id: str,
    chat_history: FirestoreChatMessageHistory,
    websocket: WebSocket,
    llm: Any,
) -> None:
    """Process a chat message."""
    message = data.get("message", "")
    user = data.get("user", "Anonymous")

    await websocket.send_json(
        {
            "type": "messageReceived",
            "data": {
                "user": user,
                "text": message,
                "timestamp": datetime.now().isoformat(),
            },
            "messageId": str(uuid.uuid4()),
        }
    )

    chat_history_messages = [
        SystemMessage(content=SESSION_SYSTEM_PROMPT),
        *chat_history.messages,
    ]

    response = await llm.apredict_messages(chat_history_messages)
    chat_history.add_user_message(message)
    chat_history.add_ai_message(response.content)

    await websocket.send_json(
        {
            "type": "aiResponse",
            "content": response.content,
            "messageId": str(uuid.uuid4()),
        }
    )


async def process_sketch_and_chat(
    data: dict,
    session_id: str,
    chat_history: FirestoreChatMessageHistory,
    websocket: WebSocket,
    llm: Any,
    imagen_model: Any,
) -> None:
    """Process a sketch and chat message."""
    message = data.get("message", "")
    sketch_base64 = data.get("sketch", "")
    user = data.get("user", "Anonymous")

    await websocket.send_json(
        {
            "type": "messageReceived",
            "data": {
                "user": user,
                "text": message,
                "sketch": sketch_base64,
                "timestamp": datetime.now().isoformat(),
            },
            "messageId": str(uuid.uuid4()),
        }
    )

    chat_history_messages = [
        SystemMessage(content=SESSION_SYSTEM_PROMPT),
        *chat_history.messages,
    ]

    response = await llm.apredict_messages(chat_history_messages)
    chat_history.add_user_message(message)
    chat_history.add_ai_message(response.content)

    await websocket.send_json(
        {
            "type": "aiResponse",
            "content": response.content,
            "messageId": str(uuid.uuid4()),
        }
    )


async def complete_session(
    session_id: str,
    chat_history: FirestoreChatMessageHistory,
    llm: Any,
) -> dict:
    """Complete a session and return the analysis."""
    summary_prompt = (
        f"Summarise the remote viewing session with ID {session_id}. "
        "Compare the target image with the modelled image. Here's the chat history:\n\n"
    )
    for msg in chat_history.messages:
        summary_prompt += f"{msg.type}: {msg.content}\n"

    response = await llm.apredict_messages([SystemMessage(content=summary_prompt)])

    return {
        "summary": response.content,
        "details": "Session completed successfully",
    }
