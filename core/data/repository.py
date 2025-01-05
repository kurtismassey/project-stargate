from typing import Generic, TypeVar
from uuid import UUID

from google.cloud import firestore

from ..models.base import BaseDocument

T = TypeVar("T", bound=BaseDocument)


class BaseRepository(Generic[T]):
    """Base repository for Firestore operations."""

    def __init__(self, model_class: type[T], collection_name: str):
        self.db = firestore.Client()
        self.model_class = model_class
        self.collection_name = collection_name

    def _to_model(self, doc_dict: dict) -> T:
        """Convert Firestore document to model instance."""
        return self.model_class(**doc_dict)

    async def create(self, model: T) -> T:
        """Create a new document."""
        doc_ref = self.db.collection(self.collection_name).document(str(model.id))
        doc_ref.set(model.to_dict())
        return model

    async def get(self, id: UUID) -> T | None:
        """Get a document by ID."""
        doc_ref = self.db.collection(self.collection_name).document(str(id))
        doc = doc_ref.get()
        return self._to_model(doc.to_dict()) if doc.exists else None

    async def update(self, model: T) -> T:
        """Update an existing document."""
        doc_ref = self.db.collection(self.collection_name).document(str(model.id))
        model.update_timestamp()
        doc_ref.update(model.to_dict())
        return model

    async def delete(self, id: UUID) -> None:
        """Delete a document."""
        doc_ref = self.db.collection(self.collection_name).document(str(id))
        doc_ref.delete()

    async def list(self, limit: int = 100) -> list[T]:
        """List documents with pagination."""
        docs = self.db.collection(self.collection_name).limit(limit).stream()
        return [self._to_model(doc.to_dict()) for doc in docs]
