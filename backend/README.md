# Capybara Coach Backend

Clean FastAPI backend for the minimum demo pipeline:

1. Upload a PDF document
2. Extract and store its text
3. Create a study session
4. Upload session audio
5. Transcribe with Azure OpenAI STT
6. Assess the explanation against the source
7. Generate clean notes

## Project shape

```text
app/
  main.py
  core/
  models/
  schemas/
  api/
  services/
```

## Local setup

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1
```

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `JWT_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_STT_DEPLOYMENT`
- `AZURE_OPENAI_TEXT_DEPLOYMENT`

If you still have the old prototype SQLite file around, delete `capybara_coach.db` once before running this rebuild.

## Main endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /documents`
- `GET /documents/{id}/file`
- `POST /documents/upload`
- `GET /notes`
- `POST /sessions`
- `POST /sessions/{id}/finish-reading`
- `POST /sessions/{id}/audio`
- `POST /sessions/{id}/transcribe`
- `POST /sessions/{id}/assess`
- `POST /sessions/{id}/notes`
- `GET /sessions/{id}`

## Smoke checks

Azure STT:

```powershell
.\.venv\Scripts\python.exe .\test_stt.py
```

Azure evaluator:

```powershell
.\.venv\Scripts\python.exe .\test_llm.py
```

Full local pipeline:

```powershell
.\.venv\Scripts\python.exe .\scripts\smoke_pipeline.py
```

## Railway

Deploy with:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required env vars:

- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `JWT_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DOCUMENTS_BUCKET=documents`
- `SUPABASE_AUDIO_BUCKET=audio`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_API_VERSION=2024-02-01`
- `AZURE_OPENAI_STT_DEPLOYMENT=gpt-4o-mini-transcribe`
- `AZURE_OPENAI_TEXT_DEPLOYMENT=gpt-4.1-mini`
