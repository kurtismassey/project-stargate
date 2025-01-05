from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class BaseDocument(BaseModel):
    """Base document model with common fields for all documents."""

    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None

    def update_timestamp(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.utcnow()

    def soft_delete(self) -> None:
        """Soft delete the document."""
        self.deleted_at = datetime.utcnow()
        self.update_timestamp()

    def to_dict(self) -> dict:
        """Convert the model to a dictionary."""
        return self.model_dump()
