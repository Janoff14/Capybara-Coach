# Capybara Coach Web

Capybara Coach is now a web-first study pipeline with:

- Next.js frontend at the repo root
- FastAPI backend in [backend](C:/Users/sanja/Shoki/backend)
- Supabase Storage for documents and audio
- Railway-hosted API
- Vercel-ready frontend

## Frontend stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style UI primitives
- TanStack Query
- React Hook Form + Zod

## Main user flow

1. Register or log in
2. Upload a PDF
3. Start a study session
4. Read the source in the browser
5. Record an explanation
6. Transcribe and assess it
7. Generate and save notes

## Local frontend setup

1. Copy [.env.example](C:/Users/sanja/Shoki/.env.example) to `.env.local`
2. Set `NEXT_PUBLIC_API_BASE_URL`
3. Install dependencies:

```powershell
npm.cmd install
```

4. Start the frontend:

```powershell
npm.cmd run dev
```

The app runs on `http://localhost:3000`.

## Frontend checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Backend

The backend lives in [backend](C:/Users/sanja/Shoki/backend). See [backend/README.md](C:/Users/sanja/Shoki/backend/README.md) for setup, env vars, and deployment notes.

For local end-to-end work, run the backend first and make sure `NEXT_PUBLIC_API_BASE_URL` points to it.
