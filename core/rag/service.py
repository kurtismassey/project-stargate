from pathlib import Path

from langchain.indexes import index
from langchain_community.document_loaders import UnstructuredPDFLoader
from langchain_core.documents import Document
from langchain_google_firestore import FirestoreVectorStore
from langchain_google_vertexai import VertexAIEmbeddings

from ..config.settings import settings
from .record_manager import FirestoreRecordManager


class RAGService:
    """Service for handling RAG operations."""

    def __init__(self):
        self.embedding = VertexAIEmbeddings(
            model_name=settings.VERTEX_AI_EMBEDDING_MODEL
        )
        self.vectorstore = FirestoreVectorStore(
            collection=settings.FIRESTORE_RECORDS_COLLECTION,
            embedding_service=self.embedding,
        )
        self.record_manager = FirestoreRecordManager(
            f"firestore/{settings.FIRESTORE_RECORDS_COLLECTION}"
        )

    async def index_documents(self, document_path: Path) -> list[Document]:
        """Index documents from a directory."""
        documents: list[Document] = []

        if document_path.is_file() and document_path.suffix == ".pdf":
            loader = UnstructuredPDFLoader(str(document_path))
            documents.extend(loader.load())
        elif document_path.is_dir():
            for pdf_file in document_path.glob("*.pdf"):
                loader = UnstructuredPDFLoader(str(pdf_file))
                documents.extend(loader.load())

        if documents:
            index(
                documents,
                self.record_manager,
                self.vectorstore,
                cleanup="incremental",
                source_id_key="source",
            )

        return documents

    async def search_similar(self, query: str, limit: int = 5) -> list[Document]:
        """Search for similar documents."""
        return self.vectorstore.similarity_search(query, k=limit)


rag_service = RAGService()
