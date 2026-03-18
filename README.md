# Capybara Coach

Capybara Coach is a prototype repo for the simplest useful product loop:

1. Record audio in Flutter
2. Upload it to FastAPI
3. Transcribe with `faster-whisper`
4. Turn the transcript into a structured note with one LLM API
5. Save the result in Postgres
6. Fetch the note back and review it

This repo intentionally keeps the stack pragmatic:

- Flutter frontend
- FastAPI backend
- Postgres for persistence
- `faster-whisper` for local speech-to-text
- One OpenAI-compatible LLM API for note cleanup, summary, and tags
- Local disk or Railway volume for audio files

## Repo layout

- [backend](C:/Users/sanja/Shoki/backend): FastAPI prototype service
- [lib](C:/Users/sanja/Shoki/lib): Flutter app
- [docs/architecture.md](C:/Users/sanja/Shoki/docs/architecture.md): notes on the current app architecture

## Backend

The backend is the current prototype priority.

Main endpoints:

- `POST /audio/upload`
- `POST /transcribe/{upload_id}`
- `POST /notes/generate/{note_id}`
- `GET /notes/{note_id}`
- `GET /notes`
- `GET /folders`

Local backend run:

```bash
cd backend
powershell -ExecutionPolicy Bypass -File .\scripts\setup_local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1
```

Notes:

- If `LLM_API_KEY` and `LLM_MODEL` are set, note generation uses the configured API.
- If they are missing, the backend falls back to a simple heuristic note generator so the prototype still runs.
- `faster-whisper` is the default STT path.
- For Railway, deploy the `backend/` folder, attach Postgres, and mount a volume for `STORAGE_DIR`.

More backend detail lives in [backend/README.md](C:/Users/sanja/Shoki/backend/README.md).

## Flutter

The Flutter app still contains the richer experimentation work, but the default mobile route is back on the recorder so the prototype demo matches the backend loop first.

Local Flutter checks:

```bash
C:\src\flutter\bin\flutter.bat analyze
C:\src\flutter\bin\flutter.bat test
```

Run on Android against Railway:

```bash
C:\src\flutter\bin\flutter.bat run -d android --dart-define=PIPELINE_MODE=fastapi --dart-define=API_BASE_URL=https://YOUR-RAILWAY-BACKEND.up.railway.app
```

The Flutter app expects compile-time defines for the backend URL. Use [.env.example](C:/Users/sanja/Shoki/.env.example) as the template for those values.

## Environment files

- Flutter/client placeholders: [.env.example](C:/Users/sanja/Shoki/.env.example)
- Backend placeholders: [backend/.env.example](C:/Users/sanja/Shoki/backend/.env.example)

## Status

What is in place now:

- Flutter app scaffold and recorder-first mobile route
- Flutter recorder flow wired to the FastAPI upload and note-polling backend
- FastAPI backend prototype with upload, transcription, note generation, note fetch, and folder listing
- Railway-ready backend Dockerfile
- Postgres-ready SQLAlchemy models

What still needs wiring:

- Auth beyond the demo user
- Better job polling and retry UX

Backend redeploy note:

- Pull the latest backend changes and redeploy Railway before testing the updated Flutter client.
- `GET /notes` now returns `user_id`, `folder_id`, and `created_at`, which the Flutter library view uses for cleaner mapping.
