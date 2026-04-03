from pathlib import Path
import os
from pydantic import Field
from pydantic_settings import BaseSettings


class NFLCVSettings(BaseSettings):
    storage_root: str = Field("backend/storage", env="NFLCV_STORAGE_ROOT")
    models_root: str = Field("backend/models", env="NFLCV_MODELS_ROOT")

    roboflow_api_key: str = Field("", env="ROBOFLOW_API_KEY")
    player_model_id: str = Field("", env="ROBOFLOW_PLAYER_MODEL_ID")
    keypoint_model_id: str = Field("", env="ROBOFLOW_KEYPOINT_MODEL_ID")
    snap_model_id: str = Field("", env="ROBOFLOW_SNAP_MODEL_ID")

    keypoint_confidence: float = Field(0.5, env="NFLCV_KEYPOINT_CONFIDENCE")
    homography_interval: int = Field(10, env="NFLCV_HOMOGRAPHY_INTERVAL")
    snap_threshold: float = Field(0.5, env="NFLCV_SNAP_THRESHOLD")

    class Config:
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        extra = "ignore"


def get_settings() -> NFLCVSettings:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key:
                os.environ[key] = value.strip().strip('"').strip("'")
    return NFLCVSettings()
