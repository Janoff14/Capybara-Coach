# Capybara Coach

Capybara Coach is an early-stage study app built around active recall instead of passive rereading.

The current product flow is simple: upload a PDF, read it in-app, switch into recall mode, explain the material from memory, get an AI-assisted assessment, then turn the result into notes, flashcards, and review sessions.

Live demo: [https://capybara-coach-web.vercel.app/](https://capybara-coach-web.vercel.app/)

## What It Does

- Upload PDF study material
- Extract and store document text
- Start study sessions from uploaded documents
- Read the source in a guided reader mode
- Record a spoken recall attempt from memory
- Transcribe and assess the explanation
- Generate notes from the assessed session
- Generate flashcards for practice
- Track review cadence with simple spaced review grading

## How It Works

1. Create an account and sign in.
2. Upload a PDF in the Documents area.
3. Start a study session for that document.
4. Read the source inside the app with lightweight guidance.
5. Move into Recall mode and explain the material out loud from memory.
6. Upload the recording for transcription and assessment.
7. Review the score, gaps, strengths, and next-step feedback.
8. Generate notes and flashcards from the session.
9. Revisit the flashcards in Practice and grade how difficult the review felt.

## Current Status

This project is still in the early stages.

It already demonstrates the core study loop well, but it still needs a lot of refinement before it feels complete. There are rough edges in the UX, more reliability work to do across the pipeline, and plenty of missing features that would make the product more useful day to day.

Some obvious next areas are:

- more polished onboarding and empty states
- better session history and progress tracking
- stronger note editing and export options
- richer flashcard generation and deck controls
- more robust review scheduling
- better mobile responsiveness
- broader document support beyond the current MVP path
- more production hardening around uploads, audio handling, and evaluation

## Tech Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

### Backend

- FastAPI
- SQLAlchemy
- JWT auth
- Supabase Storage
- Azure OpenAI for transcription and evaluation

## Screenshots

### Dashboard

![Dashboard](./artifacts/stitch-redesign/screenshots-2026-03-29/03-dashboard.png)

### Documents

![Documents](./artifacts/stitch-redesign/screenshots-2026-03-29/04-documents.png)

### Reader Mode

![Reader Mode](./artifacts/stitch-redesign/screenshots-2026-03-29/05-reader.png)

### Recall Mode

![Recall Mode](./artifacts/stitch-redesign/screenshots-2026-03-29/06-recall.png)

### Assessment

![Assessment](./artifacts/stitch-redesign/screenshots-2026-03-29/07-assessment.png)

### Practice

![Practice](./artifacts/stitch-redesign/screenshots-2026-03-29/10-practice.png)

## Local Development

### Frontend

```powershell
npm install
npm run dev
```

Create `.env.local` in the repo root:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Backend

From `backend/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1
```

Copy `backend/.env.example` to `backend/.env` and fill in the required values for:

- database
- JWT auth
- Supabase storage
- Azure OpenAI

## Repo Layout

```text
.
├─ app/         Next.js routes
├─ components/  UI and app components
├─ hooks/       Frontend hooks
├─ lib/         Shared frontend utilities and API client
├─ backend/     FastAPI API and backend services
├─ docs/        Project notes
└─ artifacts/   Screenshots and design artifacts
```
