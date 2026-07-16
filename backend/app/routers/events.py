from datetime import date, datetime, time, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_database
from ..models import EventCreate, EventPublic, EventUpdate, UserPublic, serialize
from ..security import get_current_user

router = APIRouter(prefix="/api/events", tags=["events"])


def _oid(event_id: str) -> ObjectId:
    try:
        return ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event id")


def _to_datetime(d: date) -> datetime:
    # BSON has no `date` type, so events are stored at midnight UTC.
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _normalize(doc: dict) -> dict:
    doc = serialize(doc)
    if isinstance(doc.get("date"), datetime):
        doc["date"] = doc["date"].date()
    return doc


async def _counts(db, event_id: str) -> tuple[int, int]:
    present = await db.attendance.count_documents({"event_id": event_id, "status": "present"})
    absent = await db.attendance.count_documents({"event_id": event_id, "status": "absent"})
    return present, absent


@router.get("", response_model=list[EventPublic])
async def list_events(_: UserPublic = Depends(get_current_user)):
    db = get_database()
    docs = await db.events.find().sort("date", -1).to_list(1000)
    out = []
    for d in docs:
        present, absent = await _counts(db, str(d["_id"]))
        item = _normalize(d)
        item["present_count"] = present
        item["absent_count"] = absent
        out.append(EventPublic(**item))
    return out


@router.post("", response_model=EventPublic, status_code=status.HTTP_201_CREATED)
async def create_event(payload: EventCreate, _: UserPublic = Depends(get_current_user)):
    db = get_database()
    doc = payload.model_dump()
    doc["date"] = _to_datetime(payload.date)
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.events.insert_one(doc)
    doc["_id"] = result.inserted_id
    return EventPublic(**_normalize(doc))


@router.get("/{event_id}", response_model=EventPublic)
async def get_event(event_id: str, _: UserPublic = Depends(get_current_user)):
    db = get_database()
    doc = await db.events.find_one({"_id": _oid(event_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    present, absent = await _counts(db, event_id)
    item = _normalize(doc)
    item["present_count"] = present
    item["absent_count"] = absent
    return EventPublic(**item)


@router.put("/{event_id}", response_model=EventPublic)
async def update_event(
    event_id: str, payload: EventUpdate, _: UserPublic = Depends(get_current_user)
):
    db = get_database()
    updates = payload.model_dump(exclude_unset=True)
    if "date" in updates and updates["date"] is not None:
        updates["date"] = _to_datetime(updates["date"])
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    doc = await db.events.find_one_and_update(
        {"_id": _oid(event_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    present, absent = await _counts(db, event_id)
    item = _normalize(doc)
    item["present_count"] = present
    item["absent_count"] = absent
    return EventPublic(**item)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: str, _: UserPublic = Depends(get_current_user)):
    db = get_database()
    result = await db.events.delete_one({"_id": _oid(event_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await db.attendance.delete_many({"event_id": event_id})
    return None
