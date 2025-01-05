from typing import Any

from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import SystemMessage

from ..models.session import Message, Session
from .base import BaseAIService


class RemoteViewingAIService(BaseAIService):
    """AI service for handling remote viewing sessions."""

    def __init__(self):
        super().__init__()
        self.system_prompt = """You are an AI assistant specialized in remote viewing sessions.
Your role is to guide the viewer through the session, help interpret their impressions,
and maintain the scientific protocol of remote viewing. Focus on:
1. Maintaining objectivity and avoiding leading questions
2. Encouraging detailed sensory impressions
3. Helping structure the session phases
4. Documenting and organizing the viewer's impressions"""

        self.chat_prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=self.system_prompt),
                MessagesPlaceholder(variable_name="history"),
                MessagesPlaceholder(variable_name="input"),
            ]
        )

    async def process_message(self, session: Session, message: Message) -> str:
        """Process a viewer's message and provide appropriate guidance."""
        history = self._convert_to_messages(session)
        response = await self.llm.apredict_messages(
            messages=[*history, message],
        )
        return response.content

    async def analyze_session(self, session: Session) -> dict[str, Any]:
        """Analyze a completed remote viewing session."""
        messages = self._convert_to_messages(session)

        analysis_prompt = """Analyze this remote viewing session and provide:
1. Key impressions and themes
2. Consistency in descriptions
3. Notable sensory details
4. Potential matches to the target
5. Overall session quality assessment"""

        response = await self.llm.apredict_messages(
            messages=[*messages, SystemMessage(content=analysis_prompt)]
        )

        # Parse and structure the analysis
        return {
            "analysis": response.content,
            "session_id": str(session.id),
            "timestamp": session.updated_at.isoformat(),
        }
