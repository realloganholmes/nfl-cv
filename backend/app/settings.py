from pydantic import Field
from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    database_path: str = Field("backend/data/nflcv.db", env="NFLCV_DB_PATH")
    storage_root: str = Field("backend/storage", env="NFLCV_STORAGE_ROOT")

    class Config:
        env_file = ".env"
        extra = "ignore"


def get_app_settings() -> AppSettings:
    return AppSettings()
