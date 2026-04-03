from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
import os

from inference import get_model


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def _read_env_var(name: str) -> str:
    return os.getenv(name, "")


def _load_model(model_id: str, api_key: str) -> tuple[str | None, str | None]:
    try:
        get_model(model_id=model_id, api_key=api_key)
        return model_id, None
    except Exception as exc:
        return None, str(exc)


def main() -> int:
    load_dotenv(Path(".env"))
    api_key = _read_env_var("ROBOFLOW_API_KEY")

    if not api_key:
        raise SystemExit("Missing ROBOFLOW_API_KEY in environment.")

    models = {
        "player": _read_env_var("ROBOFLOW_PLAYER_MODEL_ID"),
        "keypoint": _read_env_var("ROBOFLOW_KEYPOINT_MODEL_ID"),
        "snap": _read_env_var("ROBOFLOW_SNAP_MODEL_ID"),
        "helmet": _read_env_var("ROBOFLOW_HELMET_MODEL_ID"),
    }

    models_root = Path("backend/models")
    models_root.mkdir(parents=True, exist_ok=True)

    manifest = {"updated_at": datetime.utcnow().isoformat(), "models": {}}
    for key, model_id in models.items():
        if not model_id:
            continue
        resolved_id, error = _load_model(model_id, api_key)
        if error:
            print(f"[WARN] {key} model load failed: {error}")
        manifest["models"][key] = {
            "model_id": model_id,
            "resolved_id": resolved_id,
            "error": error,
        }

    manifest_path = models_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
