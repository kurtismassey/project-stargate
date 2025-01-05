from datetime import datetime
from enum import Enum

from pydantic import Field

from .base import BaseDocument


class SessionStatus(str, Enum):
    """Enum for session status."""

    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    TERMINATED = "terminated"


class Message(BaseDocument):
    """Model for chat messages."""

    content: str
    role: str = "user"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict = Field(default_factory=dict)


class Session(BaseDocument):
    """Model for remote viewing sessions."""

    user_id: str
    status: SessionStatus = SessionStatus.PENDING
    target_id: str | None = None
    messages: list[Message] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

    def add_message(
        self, content: str, role: str = "user", metadata: dict | None = None
    ) -> Message:
        """Add a message to the session."""
        message = Message(content=content, role=role, metadata=metadata or {})
        self.messages.append(message)
        self.update_timestamp()
        return message

    def update_status(self, status: SessionStatus) -> None:
        """Update the session status."""
        self.status = status
        self.update_timestamp()
