from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./earth_pulse.db"

    acled_api_key: str = ""
    acled_email: str = ""

    scraper_interval_hours: int = 6
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def acled_configured(self) -> bool:
        return bool(self.acled_api_key and self.acled_email)


settings = Settings()
