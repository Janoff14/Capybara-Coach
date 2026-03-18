$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:8000"

Write-Host "Checking health endpoint..."
$health = Invoke-RestMethod -Uri "$baseUrl/health"
$health | ConvertTo-Json

Write-Host ""
Write-Host "Listing demo notes..."
$notes = Invoke-RestMethod -Uri "$baseUrl/notes"
$notes | ConvertTo-Json -Depth 5
