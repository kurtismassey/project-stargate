import os
import uuid
from datetime import datetime
import json
import re
import base64
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from fastapi import WebSocket

import random
from google.cloud import storage
from google.cloud import firestore

from prompts.map import SESSION_SYSTEM_PROMPT, DETAIL_EXTRACTION_PROMPT
from session_management import broadcast_to_session

async def process_chat(data: dict, session_id: str, chat_history, websocket: WebSocket, llm):
    print("PROCESS_CHAT_REQUEST")
    message = data.get("message", "")
    user = data.get("user", "Viewer")

    try:
        user_message = HumanMessage(
            content=message,
            additional_kwargs={
                "id": data.get("id", str(uuid.uuid4())),
                "timestamp": datetime.now(),
                "user": user
            }
        )
        chat_history.add_user_message(user_message)

        await broadcast_to_session(session_id, {
            "type": "geminiStreamResponse",
            "id": data.get("id"),
            "timestamp": data.get("timestamp"),
            "user": user,
            "text": message,
            "timestamp": datetime.now().isoformat()
        }, exclude=websocket)

        chat_history_messages = [
            SystemMessage(content=SESSION_SYSTEM_PROMPT)
        ] + chat_history.messages

        message_id = str(uuid.uuid4())
        full_response = ""
        for chunk in llm.stream(chat_history_messages):
            full_response += chunk.content
            await broadcast_to_session(session_id, {
                "type": "geminiStreamResponse",
                "id": message_id,
                "text": chunk.content,
                "user": "Monitor",
                "isComplete": False
            })

        await broadcast_to_session(session_id, {
            "type": "geminiStreamResponse",
            "id": message_id,
            "isComplete": True
        })

        ai_message = AIMessage(
            content=full_response,
            additional_kwargs={
                "id": message_id,
                "timestamp": datetime.now(),
                "user": "Monitor"
            }
        )

        chat_history.add_ai_message(ai_message)
    except Exception as e:
        print(f"Error querying Gemini: {e}")
        await broadcast_to_session(session_id, {
            "type": "geminiError",
            "message": "Error processing your request"
        })

async def process_sketch_and_chat(data: dict, session_id: str, chat_history, websocket: WebSocket, llm, imagen_model):
    print("PROCESS_SKETCH_REQUEST")
    message = data.get("message", "")
    sketch_base64 = data.get("sketch")
    user = data.get("user", "Viewer")

    try:
        await broadcast_to_session(session_id, {
            "type": "geminiStreamResponse",
            "id": data.get("id"),
            "timestamp": data.get("timestamp"),
            "user": user,
            "text": message,
            "sketch": sketch_base64,
            "timestamp": datetime.now().isoformat()
        }, exclude=websocket)

        combined_text = "\n\nChat History:\n"
        for msg in chat_history.messages:
            if isinstance(msg, HumanMessage):
                combined_text += f"Human: {msg.content}\n"
            elif isinstance(msg, AIMessage):
                combined_text += f"AI: {msg.content}\n"
        
        combined_text += f"\nCurrent User Message: {message}"

        details = await extract_details_with_gemini(session_id, combined_text, sketch_base64, llm)

        combined_text = SESSION_SYSTEM_PROMPT + combined_text

        combined_query = HumanMessage(content=[
            {"type": "text", "text": combined_text},
            {"type": "image_url", "image_url": sketch_base64} if sketch_base64 is not None else {}
        ])

        message_id = str(uuid.uuid4())
        full_response = ""
        for chunk in llm.stream([combined_query]):
            full_response += chunk.content
            await broadcast_to_session(session_id, {
                "type": "geminiStreamResponse",
                "id": message_id,
                "text": full_response,
                "user": "Monitor",
                "isComplete": False
            })

        await broadcast_to_session(session_id, {
            "type": "geminiStreamResponse",
            "id": message_id,
            "isComplete": True,
            "text": full_response,
            "user": "Monitor"
        })

        user_message = HumanMessage(
            content=message,
            additional_kwargs={
                "id": data.get("id", str(uuid.uuid4())),
                "timestamp": datetime.now(),
                "user": user
            }
        )
        chat_history.add_user_message(user_message)

        ai_message = AIMessage(
            content=full_response,
            additional_kwargs={
                "id": message_id,
                "timestamp": datetime.now(),
                "user": "Monitor"
            }
        )

        chat_history.add_ai_message(ai_message)

        conversation_history = [msg.content for msg in chat_history.messages[-5:]]
        if isinstance(details, list) and len(details) > 0:
            first_detail_dict = details[0]
            if isinstance(first_detail_dict, dict):
                detail_list = first_detail_dict.get('details', [])
            else:
                detail_list = []
        else:
            detail_list = []

        print("Extracted details:", detail_list)
        
        image_base64 = await generate_target_image(session_id, detail_list, conversation_history, imagen_model)

        if image_base64:
            print("Generated image base64")

            image_path = f'sessions/{session_id}/targetModels/{str(uuid.uuid4())}.jpg'
            
            bucket = storage.Client().bucket(os.getenv("STORAGE_BUCKET"))
            blob = bucket.blob(image_path)
            blob.upload_from_string(base64.b64decode(image_base64), content_type='image/jpeg')

            db = firestore.Client()
            session_ref = db.collection('sessions').document(session_id)
            session_ref.update({
                'targetImages': firestore.ArrayUnion([image_path])
            })

            await broadcast_to_session(session_id, {
                "type": "updateTargetImage",
                "imageBase64": image_base64
            })
    except Exception as e:
        print(f"Error querying Gemini: {e}")
        await broadcast_to_session(session_id, {
            "type": "geminiError",
            "message": "Error processing your request"
        })

async def extract_details_with_gemini(session_id, combined_text, sketch_data, llm):
    combined_text = DETAIL_EXTRACTION_PROMPT + combined_text

    combined_query = HumanMessage(content=[
        {"type": "text", "text": combined_text},
        {"type": "image_url", "image_url": sketch_data}
    ])

    response = llm.invoke([combined_query])

    text = response.content
    pattern = r"```json(.*?)```"
    matches = re.findall(pattern, text, re.DOTALL)

    try:
        details = [json.loads(match.strip()) for match in matches]
        print(details)
        await broadcast_to_session(session_id, {
            "type": "updateDetails",
            "details": details[0]
        })
        return details[0]
    except Exception:
        raise ValueError(f"Failed to parse: {response}")

async def generate_target_image(session_id, details, conversation_history, imagen_model):
    prompt = f"Generate an image of a target based on the following details: {', '.join(details)}. "
    prompt += f"Additional context from conversation: {' '.join(conversation_history[-5:])}"

    try:
        images = imagen_model.generate_images(
            prompt=prompt,
            number_of_images=1,
            aspect_ratio="1:1",
        )

        image_base64 = base64.b64encode(images[0]._image_bytes).decode('utf-8')

        return image_base64
    except Exception as e:
        print(f"Error generating image: {str(e)}")
        return None

async def complete_session(session_id: str, chat_history, llm):
    print(session_id)
    db = firestore.Client()
    storage_client = storage.Client()

    bucket = storage_client.bucket(os.getenv("STORAGE_BUCKET"))
    blobs = list(bucket.list_blobs(prefix='targets/'))
    
    if blobs:
        random_target = random.choice(blobs)
        
        image_bytes = random_target.download_as_bytes()
        
        target_image_path = f'sessions/{session_id}/targetImage/actual_target.jpg'
        target_blob = bucket.blob(target_image_path)
        target_blob.upload_from_string(image_bytes, content_type='image/jpeg')
        
        modelled_blobs = list(bucket.list_blobs(prefix=f'sessions/{session_id}/targetModels'))
        if modelled_blobs:
            latest_modelled_blob = max(modelled_blobs, key=lambda x: x.time_created)
            modelled_image_path = latest_modelled_blob.name
        else:
            modelled_image_path = None
        
        session_ref = db.collection('sessions').document(session_id)
        session_ref.update({
            'status': 'completed',
            'completedAt': firestore.SERVER_TIMESTAMP,
            'targetImagePath': target_image_path,
            'modelledImagePath': modelled_image_path,
        })

        summary_prompt = f"Summarise the remote viewing session with ID {session_id}. Here's the chat history:\n\n"
        for msg in chat_history.messages:
            summary_prompt += f"{msg.additional_kwargs.get('user', 'Unknown')}: {msg.content}\n"
        
        summary_response = llm.invoke([HumanMessage(content=summary_prompt)])
        summary = summary_response.content

        session_ref.update({
            'summary': summary
        })

        print(session_ref)
        session_details = []
        try:
            print(session_ref.get())
            session_details = session_ref.get().to_dict().get('detailsList', {}).get('details', [])
        except:
            print("Failed to get details")

        return {
            'targetImagePath': target_image_path,
            'modelledImagePath': modelled_image_path,
            'summary': summary,
            'details': session_details
        }
    else:
        raise ValueError("No target images found")