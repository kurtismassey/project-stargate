from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    FRONTEND_URL: str = "https://localhost:3000"
    DATABASE_URL: str = "sqlite+aiosqlite:///database.db"

    LLM_MODEL: str = "gemini-3.6-flash"
    IMAGE_MODEL: str = "gemini-3.1-flash-image"
    GOOGLE_API_KEY: str

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


settings = Settings()
