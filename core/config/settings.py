from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Project paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    # Google Cloud settings
    GOOGLE_CLOUD_PROJECT: str
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    GOOGLE_API_KEY: str

    # Firebase Settings
    FIREBASE_ADMIN_CLIENT_EMAIL: str
    FIREBASE_ADMIN_PRIVATE_KEY: str
    STORAGE_BUCKET: str

    # Next.js Firebase Config
    NEXT_PUBLIC_FIREBASE_API_KEY: str
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: str
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: str
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: str
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: str
    NEXT_PUBLIC_FIREBASE_APP_ID: str
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: str

    # Web app settings
    CORS_ORIGINS: list[str] = ["*"]
    NEXT_PUBLIC_WEBSOCKET_URL: str = "ws://localhost:8000/session"
    WEBSOCKET_HOST: str = "0.0.0.0"
    WEBSOCKET_PORT: int = 8000

    # Firestore settings
    FIRESTORE_COLLECTION: str = "sessions"
    FIRESTORE_CHAT_COLLECTION: str = "RVSessionChats"
    FIRESTORE_RECORDS_COLLECTION: str = "stargate_records"

    # Vertex AI settings
    VERTEX_AI_LOCATION: str = "us-central1"
    VERTEX_AI_EMBEDDING_MODEL: str = "textembedding-gecko@003"
    VERTEX_AI_CHAT_MODEL: str = "gemini-1.5-pro"
    VERTEX_AI_IMAGE_MODEL: str = "imagegeneration@005"

    # RAG settings
    RAG_DOCUMENTS_PATH: str = "stargate_documents"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",  # Allow extra fields from env file
    )


settings = Settings()
