from __future__ import annotations

from typing import Any, Optional
from pathlib import Path

from inference import get_model

from nflcv.config import NFLCVSettings


def _load_model(model_id: str, api_key: str) -> Optional[Any]:
    if not model_id or not api_key:
        return None
    return get_model(model_id=model_id, api_key=api_key)


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key:
            values[key] = value.strip().strip('"').strip("'")
    return values


def load_models(settings: NFLCVSettings) -> dict[str, Optional[Any]]:
    env_values = _read_env_file(Path(__file__).resolve().parents[2] / ".env")
    api_key = settings.roboflow_api_key or env_values.get("ROBOFLOW_API_KEY", "")
    player_id = settings.player_model_id or env_values.get("ROBOFLOW_PLAYER_MODEL_ID", "")
    keypoint_id = settings.keypoint_model_id or env_values.get("ROBOFLOW_KEYPOINT_MODEL_ID", "")
    snap_id = settings.snap_model_id or env_values.get("ROBOFLOW_SNAP_MODEL_ID", "")

    models = {
        "player": _load_model(player_id, api_key),
        "keypoint": _load_model(keypoint_id, api_key),
        "snap": _load_model(snap_id, api_key),
    }
    missing = [name for name, model in models.items() if model is None]
    if missing:
        raise RuntimeError(
            "Missing or failed to load model(s): "
            + ", ".join(missing)
            + ". Check ROBOFLOW_API_KEY and ROBOFLOW_*_MODEL_ID."
        )
    return models
