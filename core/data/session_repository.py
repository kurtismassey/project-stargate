from uuid import UUID

from ..config.settings import settings
from ..models.session import Session, SessionStatus
from .repository import BaseRepository


class SessionRepository(BaseRepository[Session]):
    """Repository for handling session operations."""

    def __init__(self):
        super().__init__(Session, settings.FIRESTORE_COLLECTION)

    async def get_active_sessions(self, user_id: str) -> list[Session]:
        """Get all active sessions for a user."""
        docs = (
            self.db.collection(self.collection_name)
            .where("user_id", "==", user_id)
            .where("status", "==", SessionStatus.ACTIVE.value)
            .stream()
        )
        return [self._to_model(doc.to_dict()) for doc in docs]

    async def get_user_sessions(self, user_id: str, limit: int = 10) -> list[Session]:
        """Get recent sessions for a user."""
        docs = (
            self.db.collection(self.collection_name)
            .where("user_id", "==", user_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [self._to_model(doc.to_dict()) for doc in docs]

    async def add_message(
        self,
        session_id: UUID,
        content: str,
        role: str = "user",
        metadata: dict | None = None,
    ) -> Session | None:
        """Add a message to a session."""
        session = await self.get(session_id)
        if session:
            session.add_message(content, role, metadata)
            return await self.update(session)
        return None
