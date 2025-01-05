from collections.abc import Sequence
from datetime import datetime
from typing import Any

from google.cloud import firestore


class FirestoreRecordManager:
    """Record manager for Firestore document tracking."""

    def __init__(self, namespace: str):
        self.namespace = namespace
        self.client = firestore.Client()
        self.collection = self.client.collection(namespace)

    def create_schema(self) -> None:
        """Create any necessary schema elements."""
        pass  # Firestore is schemaless

    def get_time(self) -> datetime:
        """Get the current time."""
        return datetime.utcnow()

    def update(
        self,
        keys: Sequence[str],
        *,
        group_ids: Sequence[str] | None = None,
        embeddings: Sequence[list[float] | None] | None = None,
        full_text: Sequence[str | None] | None = None,
        metadata: Sequence[dict[str, Any] | None] | None = None,
    ) -> list[str]:
        """Update the record manager with the given keys."""
        batch = self.client.batch()
        doc_refs = []

        for i, key in enumerate(keys):
            doc_ref = self.collection.document(key)
            doc_refs.append(doc_ref.id)

            doc_data = {
                "last_updated": self.get_time(),
                "key": key,
            }

            if group_ids and i < len(group_ids):
                doc_data["group_id"] = group_ids[i]
            if embeddings and i < len(embeddings) and embeddings[i]:
                doc_data["embedding"] = embeddings[i]
            if full_text and i < len(full_text) and full_text[i]:
                doc_data["full_text"] = full_text[i]
            if metadata and i < len(metadata) and metadata[i]:
                doc_data["metadata"] = metadata[i]

            batch.set(doc_ref, doc_data, merge=True)

        batch.commit()
        return doc_refs

    def exists(self, keys: Sequence[str]) -> list[bool]:
        """Check if the given keys exist."""
        results = []
        for key in keys:
            doc = self.collection.document(key).get()
            results.append(doc.exists)
        return results

    def list_keys(self) -> list[str]:
        """List all keys in the record manager."""
        docs = self.collection.stream()
        return [doc.id for doc in docs]

    def cleanup(
        self,
        keys: Sequence[str],
    ) -> None:
        """Clean up records that are no longer needed."""
        batch = self.client.batch()
        for key in keys:
            batch.delete(self.collection.document(key))
        batch.commit()
