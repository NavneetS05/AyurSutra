from datetime import time
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://neondb_owner:npg_Qf2PeJmZhU7S@ep-lively-mode-aohq9wr9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    DATABASE_URL_UNPOOLED: str | None = "postgresql://neondb_owner:npg_Qf2PeJmZhU7S@ep-lively-mode-aohq9wr9.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    SECRET_KEY: str = "ayursutra-production-secret-key-super-secure-panchakarma"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CLINIC_NAME: str = "AyurSutra Panchakarma Centre"
    TIMEZONE: str = "Asia/Kolkata"
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
