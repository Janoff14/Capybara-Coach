$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $root ".venv"
$pythonPath = Join-Path $venvPath "Scripts\python.exe"
$envPath = Join-Path $root ".env"
$envExamplePath = Join-Path $root ".env.example"

if (-not (Test-Path $venvPath)) {
    Write-Host "Creating virtual environment..."
    python -m venv $venvPath
}

if (-not (Test-Path $pythonPath)) {
    throw "Python virtual environment was not created correctly."
}

Write-Host "Installing backend dependencies..."
& $pythonPath -m pip install --upgrade pip
& $pythonPath -m pip install -r (Join-Path $root "requirements.txt")

if (-not (Test-Path $envPath)) {
    Write-Host "Creating local .env from example..."
    Copy-Item $envExamplePath $envPath
}

Write-Host ""
Write-Host "Local backend setup is ready."
Write-Host "Edit backend/.env if you want to add LLM_API_KEY and LLM_MODEL."
Write-Host "Then run .\scripts\run_local.ps1"
