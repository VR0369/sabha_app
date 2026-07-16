from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..database import get_database
from ..models import BulkAttendance, UserPublic, serialize
from ..security import get_current_user

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


class RosterRow(BaseModel):
    attendee_id: str
    name: str
    group: str | None = None
    status: str | None = None  # "present" | "absent" | None (not yet marked)


class AttendeeHistoryRow(BaseModel):
    event_id: str
    title: str
    date: str
    status: str


def _oid(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} id")


@router.get("/event/{event_id}", response_model=list[RosterRow])
async def event_roster(event_id: str, _: UserPublic = Depends(get_current_user)):
    """All active attendees with their present/absent status for this event."""
    db = get_database()
    if not await db.events.find_one({"_id": _oid(event_id, "event")}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    marks = await db.attendance.find({"event_id": event_id}).to_list(5000)
    status_by_attendee = {m["attendee_id"]: m["status"] for m in marks}

    attendees = await db.attendees.find({"active": True}).sort("name", 1).to_list(5000)
    return [
        RosterRow(
            attendee_id=str(a["_id"]),
            name=a["name"],
            group=a.get("group"),
            status=status_by_attendee.get(str(a["_id"])),
        )
        for a in attendees
    ]


@router.post("/event/{event_id}", status_code=status.HTTP_200_OK)
async def mark_attendance(
    event_id: str, payload: BulkAttendance, user: UserPublic = Depends(get_current_user)
):
    """Upsert present/absent status for one or more attendees at an event."""
    db = get_database()
    if not await db.events.find_one({"_id": _oid(event_id, "event")}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    now = datetime.now(timezone.utc)
    updated = 0
    for record in payload.records:
        await db.attendance.update_one(
            {"event_id": event_id, "attendee_id": record.attendee_id},
            {
                "$set": {
                    "status": record.status.value,
                    "marked_by": user.name,
                    "marked_at": now,
                }
            },
            upsert=True,
        )
        updated += 1
    return {"updated": updated}


@router.get("/attendee/{attendee_id}", response_model=list[AttendeeHistoryRow])
async def attendee_history(attendee_id: str, _: UserPublic = Depends(get_current_user)):
    """Full attendance history for a single participant, newest first."""
    db = get_database()
    marks = await db.attendance.find({"attendee_id": attendee_id}).to_list(5000)
    by_event = {m["event_id"]: m["status"] for m in marks}
    if not by_event:
        return []
    event_oids = [ObjectId(eid) for eid in by_event.keys()]
    events = await db.events.find({"_id": {"$in": event_oids}}).sort("date", -1).to_list(5000)
    rows = []
    for e in events:
        eid = str(e["_id"])
        d = e["date"]
        d_str = d.date().isoformat() if isinstance(d, datetime) else str(d)
        rows.append(
            AttendeeHistoryRow(
                event_id=eid, title=e["title"], date=d_str, status=by_event[eid]
            )
        )
    return rows
