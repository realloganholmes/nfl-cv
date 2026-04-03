from __future__ import annotations

import sys
import time
from datetime import datetime
import os
from pathlib import Path

from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


from app.db import Play, get_engine, init_db  # noqa: E402
from app.settings import get_app_settings  # noqa: E402
from nflcv.config import get_settings  # noqa: E402
from nflcv.pipeline import process_video  # noqa: E402


def run_worker(poll_interval: float = 2.0) -> None:
    _load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    app_settings = get_app_settings()
    engine = get_engine(app_settings.database_path)
    init_db(engine)
    results_root = Path(app_settings.storage_root) / "results"
    results_root.mkdir(parents=True, exist_ok=True)
    settings = get_settings()

    print("[worker] started", flush=True)
    while True:
        with Session(engine) as session:
            play = session.exec(
                select(Play).where(Play.status == "queued").order_by(Play.created_at)
            ).first()
            if not play:
                print("[worker] idle", flush=True)
                time.sleep(poll_interval)
                continue

            print(f"[worker] processing {play.id} ({play.filename})", flush=True)
            play.status = "processing"
            play.updated_at = datetime.utcnow()
            session.add(play)
            session.commit()
            session.refresh(play)

            output_dir = results_root / play.id
            output_dir.mkdir(parents=True, exist_ok=True)

            try:
                print(f"[worker] running pipeline for {play.id}", flush=True)
                results_path = process_video(play.video_path, str(output_dir), settings)
                play.status = "done"
                play.progress = 1.0
                play.results_path = results_path
                play.updated_at = datetime.utcnow()
                print(f"[worker] completed {play.id}", flush=True)
            except Exception as exc:
                play.status = "failed"
                play.error_message = str(exc)
                play.updated_at = datetime.utcnow()
                print(f"[worker] failed {play.id}: {exc}", flush=True)

            session.add(play)
            session.commit()


if __name__ == "__main__":
    run_worker()
