from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import close_mongo_connection, connect_to_mongo, get_database
from .routers import attendance, attendees, auth, events, reports
from .security import hash_password


async def _bootstrap_admin() -> None:
    """Create the first admin account if the users collection is empty."""
    db = get_database()
    if await db.users.count_documents({}) > 0:
        return
    await db.users.insert_one(
        {
            "name": settings.first_admin_name,
            "email": settings.first_admin_email.lower(),
            "role": "admin",
            "hashed_password": hash_password(settings.first_admin_password),
            "created_at": datetime.now(timezone.utc),
        }
    )
    print(f"[bootstrap] Created first admin: {settings.first_admin_email}")


async def _ensure_primary_admin() -> None:
    """Guarantee the configured Google primary admin can always sign in.

    Pre-approves the account (so Google login is allowed) and keeps it in the
    admin role, without setting a password (they sign in via Google).
    """
    email = settings.primary_admin_email.lower().strip()
    if not email:
        return
    db = get_database()
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one(
            {
                "name": email.split("@")[0],
                "email": email,
                "role": "admin",
                "created_at": datetime.now(timezone.utc),
            }
        )
        print(f"[bootstrap] Pre-approved primary admin: {email}")
    elif existing.get("role") != "admin":
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"role": "admin"}})
        print(f"[bootstrap] Promoted primary admin to admin: {email}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await _bootstrap_admin()
    await _ensure_primary_admin()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="Sabha Attendance API",
    description="Backend for managing attendance of a weekly spiritual event.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(attendees.router)
app.include_router(events.router)
app.include_router(attendance.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok"}
