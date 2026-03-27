# Capybara Coach Architecture

## Current product split

### Root app

- Next.js 16 App Router frontend
- client-side JWT auth state
- TanStack Query data layer
- PDF viewing with authenticated file fetches
- browser recording with `MediaRecorder`

### `backend/`

- FastAPI API
- SQLAlchemy models for users, documents, study sessions, and notes
- Supabase Storage for PDFs and audio
- Azure OpenAI for transcription, assessment, and notes
- Railway deployment target

## Core product loop

1. User registers or logs in
2. User uploads a PDF document
3. Backend extracts and stores source text
4. User creates a study session and reads in the browser
5. User records an explanation
6. Backend transcribes the audio
7. Backend assesses recall against the source
8. Backend generates clean notes
9. User reviews saved notes in the web app

## API boundary

Frontend calls the backend directly using bearer tokens.

Main endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /documents`
- `GET /documents/{id}`
- `GET /documents/{id}/file`
- `POST /documents/upload`
- `GET /sessions`
- `GET /sessions/{id}`
- `POST /sessions`
- `POST /sessions/{id}/finish-reading`
- `POST /sessions/{id}/audio`
- `POST /sessions/{id}/transcribe`
- `POST /sessions/{id}/assess`
- `POST /sessions/{id}/notes`
- `GET /notes`
- `GET /notes/{id}`

## Deployment stance

- Frontend: Vercel
- Backend: Railway
- Storage: Supabase

This keeps the product simple and demoable without introducing workers, queues, or additional services yet.
