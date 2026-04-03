# NFL CV Local App

Local pipeline + UI for processing football play clips with offline weights.

## Quick Start

### 1) Backend setup
```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r backend/requirements.txt
copy .env.example .env
```

### 2) Validate Roboflow model access
```bash
set ROBOFLOW_API_KEY=your_key
set ROBOFLOW_PLAYER_MODEL_ID=football-players-zm06l/15
set ROBOFLOW_KEYPOINT_MODEL_ID=football-field-key-points/9
set ROBOFLOW_SNAP_MODEL_ID=snapdetection/5
python backend/scripts/refresh_weights.py
```

### 3) Run API + worker
```bash
uvicorn app.main:app --reload --app-dir backend
python backend/app/worker.py
```

### 4) Run frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Project Layout
- `backend/nflcv/` core pipeline
- `backend/app/` FastAPI + SQLite worker
- `backend/scripts/refresh_weights.py` Roboflow weights sync
- `frontend/` React + Tailwind UI

## Config
All settings live in `.env`:
- `NFLCV_STORAGE_ROOT` for videos/results
- `NFLCV_DB_PATH` for SQLite
- `ROBOFLOW_*_MODEL_ID` for hosted model IDs

## Notes
- Results are stored as JSON to allow toggling overlays on/off in the UI.
- The scrubber colors are derived from per-frame snap scores.
