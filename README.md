# 🪔 Sabha Attendance

A simple, scalable web app to manage attendance for a weekly spiritual event —
record attendees, mark who is present/absent each week, and analyze participation
trends over time.

- **Backend:** Python · FastAPI · Motor (async MongoDB)
- **Frontend:** React (Vite) · Tailwind CSS · Recharts
- **Database:** MongoDB Atlas
- **Auth:** JWT, multi-role (admin + coordinator)

## Features

| Area | What you get |
|------|--------------|
| **Attendees** | Add/edit/delete participants, groups, active/inactive, notes |
| **Search & filter** | By name/email/phone, by group, by status |
| **Events** | Weekly sessions with date, location, notes |
| **Attendance** | Mark Present/Absent per event, bulk "all present/absent", live counts |
| **History** | Full attendance history per participant |
| **Dashboard** | KPIs + attendance-rate trend, present/absent per event, group breakdown |
| **Reports** | Regulars, occasional & absentee classification |
| **Export** | Summary CSV + full attendance-register matrix CSV |
| **Users** | Admins create admin/coordinator staff accounts |

---

## Prerequisites

- **Python 3.11+** (tested on 3.13)
- **Node.js 18+** (tested on 24)
- A **MongoDB Atlas** connection string (see step 1)

> ⚠️ **Don't copy `backend/.venv` or `frontend/node_modules` between machines or
> operating systems.** They contain platform-specific binaries (e.g. a macOS
> `node_modules` or a Linux `venv` will not run on Windows). Always create them
> fresh on each machine — the steps below do that for you. Both folders are
> git-ignored so they never get committed.

## 1. Set up MongoDB Atlas (free)

1. Create a free cluster at <https://www.mongodb.com/cloud/atlas>.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → allow your IP (or `0.0.0.0/0` for development).
4. **Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

> If your password contains special characters (`@`, `:`, `/`, `#`, …) they must be
> [percent-encoded](https://www.mongodb.com/docs/manual/reference/connection-string/#std-label-connections-standard-connection-string-format)
> in the URI — e.g. `@` becomes `%40`.

## 2. Backend (FastAPI)

The `run` script creates the virtual environment (`.venv`), installs the
dependencies on first run, and starts the server with hot-reload.

### macOS / Linux

```bash
cd backend
cp .env.example .env          # then edit .env (see below)
./run.sh
```

### Windows (PowerShell)

```powershell
cd backend
Copy-Item .env.example .env   # then edit .env (see below)
.\run.ps1
```

If PowerShell blocks the script with an execution-policy error, run it as
`powershell -ExecutionPolicy Bypass -File .\run.ps1` (or allow scripts for the
current session with `Set-ExecutionPolicy -Scope Process -Bypass`).

Edit `backend/.env`:
- `MONGODB_URI` → paste your Atlas string (fill in user/password)
- `JWT_SECRET` → generate one, e.g. `python -c "import secrets; print(secrets.token_hex(32))"`
- `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` → your first login

<details>
<summary>Prefer to run it manually?</summary>

**macOS / Linux**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Windows (PowerShell)**

```powershell
py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
</details>

- API: <http://localhost:8000>
- Interactive docs (Swagger): <http://localhost:8000/docs>

On first startup the app creates the **first admin** account from your `.env`
(only if the users collection is empty).

## 3. Frontend (React)

Works the same on all platforms:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and log in with your `FIRST_ADMIN_EMAIL` /
`FIRST_ADMIN_PASSWORD`. The Vite dev server proxies `/api` to the backend on
port 8000, so no extra config is needed in development.

For a production build: `npm run build` (output in `frontend/dist/`). To point a
built frontend at a remote API, set `VITE_API_BASE` in `frontend/.env`.

## Deploy to the cloud (free)

Ready to go live? See **[DEPLOY.md](DEPLOY.md)** for a step-by-step guide to
deploying on **Render** (free) with your existing **MongoDB Atlas** database.
The repo ships a `render.yaml` Blueprint that provisions the FastAPI backend and
the static frontend together.

---

## Typical workflow

1. **Users** (admin only) → add coordinators if needed.
2. **Attendees** → add participants, optionally assign a group.
3. **Events** → create the week's session.
4. **Mark attendance** → open the event, tap Present/Absent, **Save**.
5. **Dashboard / Reports** → view trends, find regulars & absentees, export CSV.

## Roles

| Role | Can do |
|------|--------|
| **admin** | Everything, including creating staff accounts (Users page) |
| **coordinator** | Manage attendees, events, and record attendance |

## Project structure

```
Sabha App/
├── backend/
│   ├── app/
│   │   ├── main.py          # app + startup (bootstrap admin) + CORS
│   │   ├── config.py        # env settings
│   │   ├── database.py      # Mongo connection + indexes
│   │   ├── security.py      # JWT, password hashing, role guards
│   │   ├── models.py        # Pydantic schemas
│   │   └── routers/         # auth, attendees, events, attendance, reports
│   ├── requirements.txt
│   ├── .env.example
│   ├── run.sh               # macOS / Linux launcher
│   └── run.ps1              # Windows (PowerShell) launcher
└── frontend/
    ├── src/
    │   ├── api/client.js     # axios + JWT interceptor
    │   ├── context/          # auth context
    │   ├── components/       # Layout, Modal, StatCard, ProtectedRoute
    │   └── pages/            # Login, Dashboard, Attendees, Events,
    │                         # EventAttendance, Reports, Users
    ├── package.json
    └── vite.config.js
```

## API overview

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | Returns JWT + user |
| POST | `/api/auth/register` | Admin only — create staff |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/attendees` | List (search/group/active) / create |
| PUT/DELETE | `/api/attendees/{id}` | Update / delete (cascades history) |
| GET/POST | `/api/events` | List (with counts) / create |
| GET | `/api/attendance/event/{id}` | Roster with statuses |
| POST | `/api/attendance/event/{id}` | Bulk mark present/absent |
| GET | `/api/attendance/attendee/{id}` | Participant history |
| GET | `/api/reports/dashboard` | KPIs, trend, group breakdown |
| GET | `/api/reports/attendees` | Per-attendee classification |
| GET | `/api/reports/export/attendees.csv` | Summary export |
| GET | `/api/reports/export/matrix.csv` | Full register export |

## Notes on scalability

- Async FastAPI + Motor handle concurrent requests efficiently.
- MongoDB indexes are created on startup (users email, attendance uniqueness,
  event date) — see `database.py`.
- The data model supports multiple events and users out of the box; adding
  multiple *communities/branches* later means adding an `org_id` field and
  scoping queries by it.
