#!/usr/bin/env bash
# Start the FastAPI backend on macOS/Linux (creates .venv + installs deps on first run).
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> Created backend/.env — edit it and set your MONGODB_URI before continuing."
fi

exec ./.venv/bin/uvicorn app.main:app --reload --port 8000
