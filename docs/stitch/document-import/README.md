# Stitch Exports

This folder stores raw Stitch exports for the `Document Import` project (`168069345193552387`).

Files in each screen folder:

- `screenshot.png`: the hosted screen image downloaded from Stitch
- `screen.html`: the exported HTML from Stitch
- `metadata.json`: the Stitch screen metadata and original hosted URLs

To refresh these exports, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fetch_stitch_screens.ps1 `
  -ApiKey "<your-stitch-api-key>" `
  -ProjectId "168069345193552387" `
  -ScreenIds "a0453d165ee54696b6ba749eb72f73d1","9bc4d05b70104e8d9dd483d5327058fa","deab45b41f084a03966ba4f6ee6e219c","5c33ae6ca6b9497394d77183a218a032","924ff6426eb54032b572b98dc1548c28"
```
