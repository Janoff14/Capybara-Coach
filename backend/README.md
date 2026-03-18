# Capybara Coach Backend

Minimal FastAPI prototype for the core voice-note loop:

1. Upload audio
2. Transcribe with `faster-whisper`
3. Generate a structured note with one LLM API
4. Save note, tags, and folder suggestion
5. Fetch the finished note back from the API

## Local run

Fastest path on PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1
```

Manual path:

1. Create a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`. Add `LLM_API_KEY` and `LLM_MODEL` if you want live note generation instead of the heuristic fallback.
   Local-first default:
   - keep `DATABASE_URL=sqlite:///./capybara_coach.db`
   Railway deploy:
   - replace it with Railway Postgres `DATABASE_URL`
4. Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Smoke test after the server starts:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1
```

## Railway

- Create a Railway service from the `backend/` folder.
- Attach a Postgres database.
- Add a volume and set `STORAGE_DIR=/data`.
- Set `DATABASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`.
- Railway can build from the included `Dockerfile`.

## Core endpoints

- `POST /audio/upload`
- `POST /transcribe/{upload_id}`
- `POST /notes/generate/{note_id}`
- `GET /notes/{note_id}`
- `GET /notes`
- `GET /folders`
