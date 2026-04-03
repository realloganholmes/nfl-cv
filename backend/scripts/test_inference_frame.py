from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import cv2
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Roboflow inference on a single frame.")
    parser.add_argument("video", help="Path to input video")
    parser.add_argument("--frame", type=int, default=0, help="Frame index to test")
    parser.add_argument(
        "--model-id",
        default="",
        help="Override model id (e.g. football-players-zm06l/15)",
    )
    args = parser.parse_args()

    load_dotenv(Path(".env"))
    api_key = os.getenv("ROBOFLOW_API_KEY", "")
    if not api_key:
        raise SystemExit("Missing ROBOFLOW_API_KEY in environment.")

    model_id = args.model_id or os.getenv("ROBOFLOW_PLAYER_MODEL_ID", "")
    if not model_id:
        raise SystemExit("Missing model id. Provide --model-id or ROBOFLOW_PLAYER_MODEL_ID.")

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise SystemExit(f"Unable to open video: {args.video}")

    cap.set(cv2.CAP_PROP_POS_FRAMES, args.frame)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit(f"Unable to read frame {args.frame} from video.")

    model = get_model(model_id=model_id, api_key=api_key)
    result = model.infer(frame)[0]

    print("Model:", model_id)
    print("Frame:", args.frame)
    if hasattr(result, "model_dump"):
        payload = result.model_dump()
    elif hasattr(result, "dict"):
        payload = result.dict()
    elif hasattr(result, "__dict__"):
        payload = result.__dict__
    else:
        payload = str(result)

    if isinstance(payload, str):
        print(payload[:4000])
    else:
        print(json.dumps(payload, indent=2)[:4000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
