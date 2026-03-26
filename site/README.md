# Document Import Website

This is the browser frontend for the Stitch `Document Import` flow. It is served by the FastAPI backend and uses the backend's document, session, and note endpoints.

Run the backend locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\setup_local.ps1
powershell -ExecutionPolicy Bypass -File .\backend\scripts\run_local.ps1
```

Then visit:

```text
http://localhost:8000
```
