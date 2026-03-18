# Capybara Coach Architecture

## Current product priority

The repo is being pushed toward the smallest demoable loop first:

1. Record audio in Flutter
2. Upload the file
3. Transcribe it
4. Generate a structured note
5. Save it
6. Show it back to the user

The Flutter codebase still contains some broader active-recall experiments, but the default mobile route is now back on the recorder so the prototype can demonstrate the backend loop cleanly.

## Repo split

### `lib/`

- Flutter app
- Riverpod-based presentation/application/domain/data separation
- Recorder-first mobile route for the current prototype
- Library and note detail screens for review

### `backend/`

- FastAPI monolith
- SQLAlchemy models
- Local file storage for audio
- `faster-whisper` transcription
- OpenAI-compatible LLM call for structured note generation
- Railway-ready Dockerfile

## Backend model

Prototype tables:

- `users`
- `audio_uploads`
- `transcripts`
- `notes`
- `tags`
- `note_tags`
- `folders`

This is intentionally enough for:

- saving audio metadata
- storing transcripts and timestamps
- generating structured notes
- attaching tags
- grouping notes into folders

## Processing flow

`POST /audio/upload`

- saves the file to disk
- creates an `audio_upload`
- creates a placeholder `note`
- optionally starts a background task

Background task:

- runs `faster-whisper`
- saves transcript text and segments
- calls the configured LLM endpoint, or falls back to a heuristic note generator
- creates or reuses a folder
- creates or reuses tags
- updates the note to `ready`

## Why this is intentionally simple

- No Celery yet
- No Redis yet
- No separate worker service yet
- No S3 requirement yet
- No microservices

FastAPI background tasks are enough to prove the loop before adding more infrastructure.

## Deployment stance

Railway is the target prototype platform:

- one backend service from `backend/`
- one Postgres database
- optional volume for audio storage

If `faster-whisper` ends up being too heavy on Railway for the demo, the backend can keep the same endpoint shape and swap transcription implementation later.
