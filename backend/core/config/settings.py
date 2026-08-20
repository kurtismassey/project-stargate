from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    FRONTEND_URL: str = "https://localhost:3000"
    DATABASE_URL: str = "sqlite+aiosqlite:///database.db"

    LLM_MODEL: str = "gemini-3.6-flash"
    # Empty key means AI assistance is disabled and the session loop runs
    # without it. AI paths fail closed, never crash the protocol engine.
    GOOGLE_API_KEY: str = ""
    # Empty key leaves the lab open (dev and tests). Set a shared lab
    # key to gate mutating ops so a research group can close the desk.
    LAB_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )

    @property
    def ai_enabled(self) -> bool:
        return bool(self.GOOGLE_API_KEY)


settings = Settings()
