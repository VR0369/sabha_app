from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings


class _DB:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


_state = _DB()


async def connect_to_mongo() -> None:
    _state.client = AsyncIOMotorClient(settings.mongodb_uri)
    _state.db = _state.client[settings.db_name]
    await _create_indexes(_state.db)


async def close_mongo_connection() -> None:
    if _state.client is not None:
        _state.client.close()


def get_database() -> AsyncIOMotorDatabase:
    if _state.db is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return _state.db


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.attendees.create_index("email", sparse=True)
    await db.attendees.create_index("name")
    await db.events.create_index("date")
    # One attendance record per (event, attendee).
    await db.attendance.create_index(
        [("event_id", 1), ("attendee_id", 1)], unique=True
    )
