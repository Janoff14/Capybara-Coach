$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonPath)) {
    throw "Virtual environment is missing. Run .\scripts\setup_local.ps1 first."
}

Push-Location $root
try {
    & $pythonPath .\scripts\smoke_pipeline.py
}
finally {
    Pop-Location
}
