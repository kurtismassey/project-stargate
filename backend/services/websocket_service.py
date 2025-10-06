import asyncio
import json
from datetime import datetime
from uuid import UUID

from agents import (
    analyse_session,
    generate_target_model_image,
    get_monitor_response,
    select_random_target_image,
)
from core.config.logger import logger
from core.connections import session_manager
from core.db import engine
from core.models.scoring import SessionScore
from core.models.session import ChatMessage, Drawing, Role
from core.models.session import Session as SessionModel
from core.models.session import SessionStatus, Stage
from core.models.websocket import EventType
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import selectinload
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

active_session_list_connections: list[WebSocket] = []


async def broadcast_to_session_list(message: str):
    for connection in active_session_list_connections:
        await connection.send_text(message)


async def _receive_session_list_messages(websocket: WebSocket):
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == EventType.CREATE_SESSION:
                try:
                    # Select a random target image at session creation
                    target_image_b64 = await select_random_target_image()

                    async with AsyncSession(
                        engine, expire_on_commit=False
                    ) as db_session:
                        session = SessionModel(target_image=target_image_b64)
                        db_session.add(session)
                        await db_session.commit()
                        await db_session.refresh(session)

                        session_dict = {
                            "id": str(session.id),
                            "createdAt": session.created_at.isoformat(),
                            "updatedAt": session.updated_at.isoformat(),
                            "status": session.status.value,
                        }
                        broadcast_message = {
                            "type": EventType.SESSION_CREATED,
                            "session": session_dict,
                        }
                        await broadcast_to_session_list(json.dumps(broadcast_message))
                except Exception as e:
                    logger.error(f"Error creating session: {e}")
                    error_message = {
                        "type": "error",
                        "message": f"Failed to create session: {str(e)}",
                    }
                    await websocket.send_text(json.dumps(error_message))
            elif msg_type == EventType.DELETE_SESSION:
                session_id = message.get("data", {}).get("sessionId")
                if session_id:
                    async with AsyncSession(
                        engine, expire_on_commit=False
                    ) as db_session:
                        session_to_delete = await db_session.get(
                            SessionModel, UUID(session_id)
                        )
                        if session_to_delete:
                            await db_session.delete(session_to_delete)
                            await db_session.commit()

                            broadcast_message = {
                                "type": EventType.SESSION_DELETED,
                                "sessionId": session_id,
                            }
                            await broadcast_to_session_list(
                                json.dumps(broadcast_message)
                            )
    except json.JSONDecodeError:
        logger.info("Invalid JSON received")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.info(f"Error processing message: {e}")


async def handle_websocket_session(websocket: WebSocket):
    await websocket.accept()
    active_session_list_connections.append(websocket)

    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            statement = select(SessionModel)
            results = await session.exec(statement)
            sessions = results.all()

            sessions_data = [
                {
                    "id": str(s.id),
                    "createdAt": s.created_at.isoformat(),
                    "updatedAt": s.updated_at.isoformat(),
                    "status": s.status.value,
                }
                for s in sessions
            ]

            await websocket.send_text(
                json.dumps({"type": EventType.SESSIONS, "sessions": sessions_data})
            )

        receive_task = asyncio.create_task(_receive_session_list_messages(websocket))
        heartbeat_task = asyncio.create_task(_send_heartbeats(websocket))

        await asyncio.wait(
            [receive_task, heartbeat_task], return_when=asyncio.FIRST_COMPLETED
        )

    except WebSocketDisconnect:
        active_session_list_connections.remove(websocket)
    except Exception as e:
        logger.info(f"WebSocket error: {e}")
        if websocket in active_session_list_connections:
            active_session_list_connections.remove(websocket)
    finally:
        if websocket in active_session_list_connections:
            active_session_list_connections.remove(websocket)


async def _receive_messages(websocket: WebSocket, session_id: str):
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == EventType.DRAW:
                async with AsyncSession(engine, expire_on_commit=False) as db_session:
                    drawing = Drawing(
                        session_id=UUID(session_id),
                        stage=Stage(message.get("stageNumber")),
                        prev_x=message.get("prevX"),
                        prev_y=message.get("prevY"),
                        x=message.get("x"),
                        y=message.get("y"),
                        color=message.get("color"),
                    )
                    db_session.add(drawing)
                    await db_session.commit()
                    await db_session.refresh(drawing)

                    broadcast_payload = drawing.model_dump(mode="json")
                    broadcast_payload["type"] = EventType.DRAW

                    await session_manager.broadcast_to_all(
                        json.dumps(broadcast_payload), session_id
                    )
            elif msg_type == EventType.CLEAR:
                stage_to_clear = message.get("stageNumber")
                if stage_to_clear is not None:
                    async with AsyncSession(
                        engine, expire_on_commit=False
                    ) as db_session:
                        statement = (
                            delete(Drawing)
                            .where(Drawing.session_id == UUID(session_id))  # type: ignore
                            .where(Drawing.stage == Stage(stage_to_clear))  # type: ignore
                        )
                        await db_session.exec(statement)
                        await db_session.commit()
                await session_manager.broadcast(data, session_id, exclude=websocket)
            elif msg_type == EventType.COMPLETE_SESSION:
                session_dump = None
                session_drawings = None
                async with AsyncSession(engine, expire_on_commit=False) as db_session:
                    session_statement = (
                        select(SessionModel)
                        .where(SessionModel.id == UUID(session_id))
                        .options(
                            selectinload(SessionModel.chat),  # type: ignore
                            selectinload(SessionModel.drawings),  # type: ignore
                        )
                    )
                    results = await db_session.exec(session_statement)
                    session = results.one_or_none()

                    if session:
                        session.status = SessionStatus.ASSESSING
                        db_session.add(session)
                        await db_session.commit()
                        await db_session.refresh(session)
                        session_dump = session.model_dump()
                        session_drawings = message.get("drawings", [])
                        await broadcast_to_session_list(
                            json.dumps(
                                {
                                    "type": EventType.SESSION_UPDATED,
                                    "session": {
                                        "id": str(session.id),
                                        "createdAt": session.created_at.isoformat(),
                                        "updatedAt": session.updated_at.isoformat(),
                                        "status": session.status.value,
                                    },
                                }
                            )
                        )
                if session_dump:
                    try:
                        session_copy = SessionModel.model_validate(session_dump)
                        target_image_b64 = session_copy.target_image

                        # Create detailed description from chat history and drawings
                        chat_descriptions = []
                        for chat_msg in session_copy.chat:
                            if chat_msg.user == Role.VIEWER and chat_msg.text.strip():
                                chat_descriptions.append(
                                    f"Stage {chat_msg.stage}: {chat_msg.text}"
                                )

                        # Combine chat descriptions with drawing information
                        detailed_description = f"Remote viewing session with {len(session_drawings or [])} drawing stages. "
                        if chat_descriptions:
                            detailed_description += (
                                "Viewer descriptions: " + " | ".join(chat_descriptions)
                            )
                        else:
                            detailed_description += "No verbal descriptions provided, relying on visual sketches only."

                        # Convert drawings to base64 strings for target model generation
                        sketches_for_target = []
                        if session_drawings:
                            for drawing_data in session_drawings:
                                if drawing_data and drawing_data.strip():
                                    # Ensure it's a proper data URL
                                    if not drawing_data.startswith("data:image"):
                                        drawing_data = (
                                            f"data:image/jpeg;base64,{drawing_data}"
                                        )
                                    sketches_for_target.append(drawing_data)

                        target_model_b64 = await generate_target_model_image(
                            detailed_description, sketches=sketches_for_target
                        )
                        analysis = await analyse_session(
                            session=session_copy,
                            drawings=session_drawings or [],
                            target_image=target_image_b64,
                            target_model=target_model_b64,
                        )

                        analysis_payload = {
                            "type": EventType.SESSION_ANALYSIS,
                            "analysis": analysis.model_dump(mode="json"),
                            "targetImage": target_image_b64,
                            "targetModel": target_model_b64,
                        }
                        await session_manager.broadcast_to_all(
                            json.dumps(analysis_payload), session_id
                        )

                        async with AsyncSession(
                            engine, expire_on_commit=False
                        ) as db_session:
                            session_to_complete = await db_session.get(
                                SessionModel, UUID(session_id)
                            )
                            if session_to_complete:
                                session_to_complete.status = SessionStatus.COMPLETED
                                session_to_complete.target_model = target_model_b64
                                # target_image is already set at session creation, don't overwrite
                                db_session.add(session_to_complete)
                                await db_session.commit()
                                await db_session.refresh(session_to_complete)

                                # Create comprehensive analysis record
                                session_analysis = SessionScore(
                                    session_id=UUID(session_id),
                                    overall_quality_score=analysis.overall_quality_score,
                                    target_accuracy_score=analysis.target_accuracy_score,
                                    sensory_details_score=analysis.sensory_details_score,
                                    dimensional_data_score=analysis.dimensional_data_score,
                                    emotional_energetic_score=analysis.emotional_energetic_score,
                                    aol_contamination_score=analysis.aol_contamination_score,
                                    consistency_score=analysis.consistency_score,
                                    stage_development_score=analysis.stage_development_score,
                                    composite_score=analysis.composite_score,
                                    strengths=analysis.session_strengths,
                                    weaknesses=analysis.session_weaknesses,
                                    aol_instances=analysis.aol_instances,
                                    target_correlations=analysis.target_correlations,
                                )
                                db_session.add(session_analysis)
                                await db_session.commit()
                                await db_session.refresh(session_analysis)
                                await broadcast_to_session_list(
                                    json.dumps(
                                        {
                                            "type": EventType.SESSION_UPDATED,
                                            "session": {
                                                "id": str(session_to_complete.id),
                                                "createdAt": session_to_complete.created_at.isoformat(),
                                                "updatedAt": session_to_complete.updated_at.isoformat(),
                                                "status": session_to_complete.status.value,
                                            },
                                        }
                                    )
                                )
                    except Exception as e:
                        logger.error(f"Error completing session {session_id}: {e}")
                        async with AsyncSession(
                            engine, expire_on_commit=False
                        ) as db_session:
                            session_to_fail = await db_session.get(
                                SessionModel, UUID(session_id)
                            )
                            if session_to_fail:
                                session_to_fail.status = (
                                    SessionStatus.ASSESSING
                                )  # Keep as assessing if analysis fails
                                db_session.add(session_to_fail)
                                await db_session.commit()

                        error_payload = {
                            "type": "error",
                            "message": f"Failed to complete session analysis: {str(e)}",
                        }
                        await session_manager.broadcast_to_all(
                            json.dumps(error_payload), session_id
                        )
            elif msg_type == EventType.SYNC_STAGE:
                async with AsyncSession(engine, expire_on_commit=False) as db_session:
                    session = await db_session.get(SessionModel, UUID(session_id))
                    if session:
                        session.stage = message.get("stageNumber")
                        session.updated_at = datetime.utcnow()
                        db_session.add(session)
                        await db_session.commit()
                await session_manager.broadcast(data, session_id, exclude=websocket)
            elif msg_type == EventType.CHAT:
                chat_history_dump = []
                chat_message_dump = None
                async with AsyncSession(engine, expire_on_commit=False) as db_session:
                    chat_statement = (
                        select(SessionModel)
                        .where(SessionModel.id == UUID(session_id))
                        .options(selectinload(SessionModel.chat))  # type: ignore
                    )
                    results = await db_session.exec(chat_statement)
                    session = results.one_or_none()

                    if not session:
                        return

                    chat_history = list(session.chat)

                    chat_message = ChatMessage(
                        user=message.get("user", Role.VIEWER),
                        text=message.get("text", ""),
                        session_id=UUID(session_id),
                        stage=Stage(message.get("stage")),
                    )

                    db_session.add(chat_message)
                    await db_session.commit()
                    await db_session.refresh(chat_message)

                    chat_history_dump = [
                        m.model_dump()
                        for m in chat_history
                        if m.stage == Stage(message.get("stage"))
                    ]
                    chat_message_dump = chat_message.model_dump()
                    drawing_data = message.get("drawing")

                    broadcast_payload = chat_message.model_dump(mode="json")
                    broadcast_payload["type"] = EventType.CHAT
                    broadcast_payload["sessionId"] = broadcast_payload.pop("session_id")

                    await session_manager.broadcast_to_all(
                        json.dumps(broadcast_payload), session_id
                    )

                history_copies = [
                    ChatMessage.model_validate(m) for m in chat_history_dump
                ]
                message_copy = ChatMessage.model_validate(chat_message_dump)
                response = await get_monitor_response(
                    chat_history=history_copies,
                    message=message_copy,
                    drawing_data=drawing_data,
                )

                async with AsyncSession(engine, expire_on_commit=False) as db_session:
                    monitor_message = ChatMessage(
                        user=Role.MONITOR,
                        text=response,
                        session_id=UUID(session_id),
                        stage=Stage(message.get("stage")),
                    )
                    db_session.add(monitor_message)
                    await db_session.commit()
                    await db_session.refresh(monitor_message)

                    broadcast_payload = monitor_message.model_dump(mode="json")
                    broadcast_payload["type"] = EventType.CHAT
                    broadcast_payload["sessionId"] = broadcast_payload.pop("session_id")
                    await session_manager.broadcast_to_all(
                        json.dumps(broadcast_payload), session_id
                    )
    except json.JSONDecodeError:
        logger.info("Invalid JSON received")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.info(f"Error processing message: {e}")


async def _send_heartbeats(websocket: WebSocket):
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": EventType.HEARTBEAT}))
    except Exception:
        pass


async def handle_websocket_session_individual(websocket: WebSocket, session_id: str):
    await session_manager.connect(websocket, session_id)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as db_session:
            statement = (
                select(SessionModel)
                .where(SessionModel.id == UUID(session_id))
                .options(selectinload(SessionModel.analysis))  # type: ignore
            )
            results = await db_session.exec(statement)
            session = results.one_or_none()
            if not session:
                logger.info(f"Session {session_id} not found")
                await websocket.close(code=1000, reason="Session not found")
                return

            await websocket.send_text(
                json.dumps(
                    {
                        "type": EventType.SESSION_CONNECTED,
                        "sessionId": session_id,
                        "currentStage": session.stage,
                    }
                )
            )

            chat_statement = (
                select(ChatMessage)
                .where(ChatMessage.session_id == UUID(session_id))
                .order_by(ChatMessage.timestamp)  # type: ignore
            )
            chat_results = await db_session.exec(chat_statement)
            chat_history = chat_results.all()

            history_payload = [msg.model_dump(mode="json") for msg in chat_history]
            await websocket.send_text(
                json.dumps({"type": EventType.CHAT_HISTORY, "history": history_payload})
            )

            drawing_statement = select(Drawing).where(
                Drawing.session_id == UUID(session_id)
            )
            drawing_results = await db_session.exec(drawing_statement)
            drawing_history = drawing_results.all()

            drawing_history_payload = [
                d.model_dump(mode="json") for d in drawing_history
            ]
            await websocket.send_text(
                json.dumps(
                    {
                        "type": EventType.DRAWING_HISTORY,
                        "history": drawing_history_payload,
                    }
                )
            )

            if session.analysis:
                # Convert SessionScore to the format expected by frontend
                analysis_data = {
                    "overall_summary": f"Session analysis with composite score {session.analysis.composite_score:.1f}/7",
                    "stage_by_stage_analysis": [],
                    "final_assessment_score": int(session.analysis.composite_score),
                    "overall_quality_score": session.analysis.overall_quality_score,
                    "target_accuracy_score": session.analysis.target_accuracy_score,
                    "sensory_details_score": session.analysis.sensory_details_score,
                    "dimensional_data_score": session.analysis.dimensional_data_score,
                    "emotional_energetic_score": session.analysis.emotional_energetic_score,
                    "aol_contamination_score": session.analysis.aol_contamination_score,
                    "consistency_score": session.analysis.consistency_score,
                    "stage_development_score": session.analysis.stage_development_score,
                    "composite_score": session.analysis.composite_score,
                    "session_strengths": session.analysis.strengths,
                    "session_weaknesses": session.analysis.weaknesses,
                    "aol_instances": session.analysis.aol_instances,
                    "target_correlations": session.analysis.target_correlations,
                }

                analysis_payload = {
                    "type": EventType.SESSION_ANALYSIS,
                    "analysis": analysis_data,
                    "targetImage": session.target_image,
                    "targetModel": session.target_model,
                }
                await websocket.send_text(json.dumps(analysis_payload))

        receive_task = asyncio.create_task(_receive_messages(websocket, session_id))
        heartbeat_task = asyncio.create_task(_send_heartbeats(websocket))
        await asyncio.wait(
            [receive_task, heartbeat_task], return_when=asyncio.FIRST_COMPLETED
        )
    except WebSocketDisconnect:
        logger.info(f"[Session {session_id}] WebSocket disconnected")
    except Exception as e:
        logger.info(f"[Session {session_id}] WebSocket error: {e}")
    finally:
        session_manager.disconnect(websocket, session_id)
