from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from core.models.scoring import SessionScore
from sqlmodel import Field, Relationship, SQLModel


class SessionStatus(str, Enum):
    """
    Session status
    """

    ACTIVE = "active"
    COMPLETED = "completed"
    ASSESSING = "assessing"


class Role(str, Enum):
    """
    Role
    """

    VIEWER = "viewer"
    MONITOR = "monitor"


class Stage(int, Enum):
    STAGE_I = 1
    STAGE_II = 2
    STAGE_III = 3
    STAGE_IV = 4
    STAGE_V = 5
    STAGE_VI = 6


class Session(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)

    status: SessionStatus = Field(default=SessionStatus.ACTIVE, nullable=False)
    stage: Stage = Field(default=Stage.STAGE_I, nullable=False)
    target_image: str | None = Field(default=None)
    target_model: str | None = Field(default=None)

    chat: list["ChatMessage"] = Relationship(back_populates="session")
    drawings: list["Drawing"] = Relationship(back_populates="session")
    analysis: SessionScore | None = Relationship(back_populates="session")

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class ChatMessage(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Role = Field(default=Role.VIEWER)
    text: str
    stage: Stage

    session_id: UUID = Field(foreign_key="session.id")
    session: Session | None = Relationship(back_populates="chat")


class Drawing(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    stage: Stage
    prev_x: float
    prev_y: float
    x: float
    y: float
    color: str
    session_id: UUID = Field(foreign_key="session.id")

    session: Session | None = Relationship(back_populates="drawings")
