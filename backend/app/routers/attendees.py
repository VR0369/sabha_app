from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_database
from ..models import (
    AttendeeCreate,
    AttendeePublic,
    AttendeeUpdate,
    UserPublic,
    serialize,
)
from ..security import get_current_user

router = APIRouter(prefix="/api/attendees", tags=["attendees"])


def _oid(attendee_id: str) -> ObjectId:
    try:
        return ObjectId(attendee_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid attendee id")


@router.get("", response_model=list[AttendeePublic])
async def list_attendees(
    search: str | None = Query(default=None, description="Match name, email or phone"),
    group: str | None = None,
    active: bool | None = None,
    _: UserPublic = Depends(get_current_user),
):
    db = get_database()
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if group:
        query["group"] = group
    if active is not None:
        query["active"] = active
    docs = await db.attendees.find(query).sort("name", 1).to_list(2000)
    return [AttendeePublic(**serialize(d)) for d in docs]


@router.get("/groups", response_model=list[str])
async def list_groups(_: UserPublic = Depends(get_current_user)):
    db = get_database()
    groups = await db.attendees.distinct("group")
    return sorted([g for g in groups if g])


@router.post("", response_model=AttendeePublic, status_code=status.HTTP_201_CREATED)
async def create_attendee(payload: AttendeeCreate, _: UserPublic = Depends(get_current_user)):
    db = get_database()
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.attendees.insert_one(doc)
    doc["_id"] = result.inserted_id
    return AttendeePublic(**serialize(doc))


@router.get("/{attendee_id}", response_model=AttendeePublic)
async def get_attendee(attendee_id: str, _: UserPublic = Depends(get_current_user)):
    db = get_database()
    doc = await db.attendees.find_one({"_id": _oid(attendee_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found")
    return AttendeePublic(**serialize(doc))


@router.put("/{attendee_id}", response_model=AttendeePublic)
async def update_attendee(
    attendee_id: str, payload: AttendeeUpdate, _: UserPublic = Depends(get_current_user)
):
    db = get_database()
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    doc = await db.attendees.find_one_and_update(
        {"_id": _oid(attendee_id)},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found")
    return AttendeePublic(**serialize(doc))


@router.delete("/{attendee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendee(attendee_id: str, _: UserPublic = Depends(get_current_user)):
    db = get_database()
    oid = _oid(attendee_id)
    result = await db.attendees.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found")
    # Remove this attendee's attendance history too.
    await db.attendance.delete_many({"attendee_id": attendee_id})
    return None
