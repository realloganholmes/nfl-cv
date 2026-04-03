from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, Session, SQLModel, create_engine, select


class Play(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    filename: str
    status: str = Field(default="queued", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    progress: float = Field(default=0.0)
    video_path: str
    results_path: Optional[str] = None
    error_message: Optional[str] = None


def get_engine(db_path: str):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})


def init_db(engine) -> None:
    SQLModel.metadata.create_all(engine)


def get_play(session: Session, play_id: str) -> Optional[Play]:
    statement = select(Play).where(Play.id == play_id)
    return session.exec(statement).first()
