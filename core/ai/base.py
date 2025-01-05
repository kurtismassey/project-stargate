from abc import ABC, abstractmethod
from typing import Any

from langchain.schema import AIMessage, HumanMessage, SystemMessage
from langchain_google_vertexai import ChatVertexAI

from ..config.settings import settings
from ..models.session import Message, Session


class BaseAIService(ABC):
    """Base class for AI services."""

    def __init__(self):
        self.llm = ChatVertexAI(
            model_name="gemini-1.0-pro",
            location=settings.VERTEX_AI_LOCATION,
            max_output_tokens=2048,
            temperature=0.7,
        )

    def _convert_to_messages(self, session: Session) -> list[Any]:
        """Convert session messages to LangChain message format."""
        messages = []
        for msg in session.messages:
            if msg.role == "system":
                messages.append(SystemMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
            else:
                messages.append(HumanMessage(content=msg.content))
        return messages

    @abstractmethod
    async def process_message(self, session: Session, message: Message) -> str:
        """Process a message and return a response."""
        pass

    @abstractmethod
    async def analyze_session(self, session: Session) -> dict[str, Any]:
        """Analyze a completed session and return insights."""
        pass
