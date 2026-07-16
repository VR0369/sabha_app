#!/usr/bin/env pwsh
# Start the FastAPI backend on Windows (creates .venv + installs deps on first run).
#
# Usage (from the backend/ folder):
#     .\run.ps1
#
# If PowerShell blocks the script, either run it as:
#     powershell -ExecutionPolicy Bypass -File .\run.ps1
# or allow scripts for the current session first:
#     Set-ExecutionPolicy -Scope Process -Bypass

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# Prefer the Windows 'py' launcher; fall back to 'python' on PATH.
$py = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }

if (-not (Test-Path ".venv")) {
    & $py -m venv .venv
    & .\.venv\Scripts\python.exe -m pip install --upgrade pip
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ">> Created backend/.env - edit it and set your MONGODB_URI before continuing."
}

& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
