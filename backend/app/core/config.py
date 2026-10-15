from datetime import time
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "sqlite:///./ayursutra_dev.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CLINIC_NAME: str = "AyurSutra Panchakarma Centre"
    CLINIC_OPEN_TIME: str = "08:00"
    CLINIC_CLOSE_TIME: str = "20:00"

    PDF_OUTPUT_DIR: str = "./generated_pdfs"

    @property
    def clinic_open(self) -> time:
        h, m = map(int, self.CLINIC_OPEN_TIME.split(":"))
        return time(h, m)

    @property
    def clinic_close(self) -> time:
        h, m = map(int, self.CLINIC_CLOSE_TIME.split(":"))
        return time(h, m)


settings = Settings()
