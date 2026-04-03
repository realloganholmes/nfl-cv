from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlmodel import Session, select

from app.db import Play, get_engine, get_play, init_db
from app.settings import get_app_settings


app = FastAPI(title="NFL CV Local API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_app_settings()
engine = get_engine(settings.database_path)
init_db(engine)

storage_root = Path(settings.storage_root)
videos_root = storage_root / "videos"
results_root = storage_root / "results"
videos_root.mkdir(parents=True, exist_ok=True)
results_root.mkdir(parents=True, exist_ok=True)


def _serialize_play(play: Play) -> dict:
    return {
        "id": play.id,
        "filename": play.filename,
        "status": play.status,
        "created_at": play.created_at.isoformat(),
        "updated_at": play.updated_at.isoformat(),
        "progress": play.progress,
        "video_path": play.video_path,
        "results_path": play.results_path,
        "error_message": play.error_message,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/plays")
async def upload_play(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    with Session(engine) as session:
        play = Play(
            filename=file.filename,
            status="queued",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            progress=0.0,
            video_path="",
        )
        session.add(play)
        session.commit()
        session.refresh(play)

        destination = videos_root / f"{play.id}_{file.filename}"
        with destination.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

        play.video_path = str(destination)
        play.updated_at = datetime.utcnow()
        session.add(play)
        session.commit()
        session.refresh(play)

    return _serialize_play(play)


@app.get("/plays")
def list_plays() -> List[dict]:
    with Session(engine) as session:
        plays = session.exec(select(Play).order_by(Play.created_at.desc())).all()
        return [_serialize_play(play) for play in plays]


@app.get("/plays/{play_id}")
def get_play_details(play_id: str):
    with Session(engine) as session:
        play = get_play(session, play_id)
        if not play:
            raise HTTPException(status_code=404, detail="Play not found.")
        return _serialize_play(play)


@app.get("/plays/{play_id}/results")
def get_play_results(play_id: str):
    with Session(engine) as session:
        play = get_play(session, play_id)
        if not play or not play.results_path:
            raise HTTPException(status_code=404, detail="Results not found.")
        path = Path(play.results_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Results file missing.")
        return JSONResponse(content=json.loads(path.read_text(encoding="utf-8")))


@app.get("/plays/{play_id}/video")
def get_play_video(play_id: str):
    with Session(engine) as session:
        play = get_play(session, play_id)
        if not play or not play.video_path:
            raise HTTPException(status_code=404, detail="Video not found.")
        path = Path(play.video_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Video file missing.")
        return FileResponse(path)
