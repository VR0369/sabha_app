import csv
import io
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..database import get_database
from ..models import UserPublic
from ..security import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

REGULAR_THRESHOLD = 0.75
ABSENTEE_THRESHOLD = 0.25

_PRESENT = {"$sum": {"$cond": [{"$eq": ["$status", "present"]}, 1, 0]}}
_ABSENT = {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}}


def _event_date_str(value) -> str:
    return value.date().isoformat() if isinstance(value, datetime) else str(value)


async def _attendee_stats(db) -> list[dict]:
    """Per-attendee attendance summary, ordered by attendance rate desc."""
    total_events = await db.events.count_documents({})

    pipeline = [
        {
            "$group": {
                "_id": "$attendee_id",
                "present": _PRESENT,
                "absent": _ABSENT,
                "last_marked": {"$max": "$marked_at"},
            }
        }
    ]
    agg = {row["_id"]: row async for row in db.attendance.aggregate(pipeline)}

    attendees = await db.attendees.find().sort("name", 1).to_list(5000)
    rows = []
    for a in attendees:
        aid = str(a["_id"])
        stat = agg.get(aid, {})
        present = stat.get("present", 0)
        absent = stat.get("absent", 0)
        rate = round(present / total_events, 4) if total_events else 0.0
        if rate >= REGULAR_THRESHOLD:
            category = "regular"
        elif rate <= ABSENTEE_THRESHOLD:
            category = "absentee"
        else:
            category = "occasional"
        rows.append(
            {
                "attendee_id": aid,
                "name": a["name"],
                "group": a.get("group"),
                "active": a.get("active", True),
                "present": present,
                "absent": absent,
                "total_events": total_events,
                "attendance_rate": rate,
                "category": category,
                "last_attended": stat.get("last_marked").isoformat()
                if stat.get("last_marked")
                else None,
            }
        )
    rows.sort(key=lambda r: r["attendance_rate"], reverse=True)
    return rows


async def _event_trend(db) -> list[dict]:
    pipeline = [
        {"$group": {"_id": "$event_id", "present": _PRESENT, "absent": _ABSENT}},
    ]
    agg = {row["_id"]: row async for row in db.attendance.aggregate(pipeline)}
    events = await db.events.find().sort("date", 1).to_list(2000)
    trend = []
    for e in events:
        eid = str(e["_id"])
        stat = agg.get(eid, {})
        present = stat.get("present", 0)
        absent = stat.get("absent", 0)
        marked = present + absent
        trend.append(
            {
                "event_id": eid,
                "title": e["title"],
                "date": _event_date_str(e["date"]),
                "present": present,
                "absent": absent,
                "attendance_rate": round(present / marked, 4) if marked else 0.0,
            }
        )
    return trend


@router.get("/dashboard")
async def dashboard(_: UserPublic = Depends(get_current_user)):
    db = get_database()
    total_attendees = await db.attendees.count_documents({})
    active_attendees = await db.attendees.count_documents({"active": True})
    total_events = await db.events.count_documents({})

    trend = await _event_trend(db)
    stats = await _attendee_stats(db)

    total_present = sum(t["present"] for t in trend)
    total_marked = sum(t["present"] + t["absent"] for t in trend)
    overall_rate = round(total_present / total_marked, 4) if total_marked else 0.0

    regulars = [s for s in stats if s["category"] == "regular"]
    absentees = [s for s in stats if s["category"] == "absentee" and s["active"]]

    by_group: dict[str, dict] = {}
    for s in stats:
        g = s["group"] or "Ungrouped"
        bucket = by_group.setdefault(g, {"group": g, "present": 0, "total": 0})
        bucket["present"] += s["present"]
        bucket["total"] += s["total_events"]
    group_breakdown = [
        {
            "group": g["group"],
            "attendance_rate": round(g["present"] / g["total"], 4) if g["total"] else 0.0,
        }
        for g in by_group.values()
    ]

    return {
        "totals": {
            "attendees": total_attendees,
            "active_attendees": active_attendees,
            "events": total_events,
            "overall_attendance_rate": overall_rate,
            "regular_count": len(regulars),
            "absentee_count": len(absentees),
        },
        "trend": trend,
        "top_regulars": regulars[:5],
        "top_absentees": absentees[-5:][::-1],
        "group_breakdown": sorted(group_breakdown, key=lambda x: x["attendance_rate"], reverse=True),
    }


@router.get("/attendees")
async def attendee_report(_: UserPublic = Depends(get_current_user)):
    db = get_database()
    return await _attendee_stats(db)


@router.get("/export/attendees.csv")
async def export_attendees_csv(_: UserPublic = Depends(get_current_user)):
    db = get_database()
    rows = await _attendee_stats(db)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Name", "Group", "Active", "Present", "Absent", "Total Events",
         "Attendance Rate %", "Category", "Last Attended"]
    )
    for r in rows:
        writer.writerow([
            r["name"], r["group"] or "", "Yes" if r["active"] else "No",
            r["present"], r["absent"], r["total_events"],
            round(r["attendance_rate"] * 100, 1), r["category"], r["last_attended"] or "",
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendee_report.csv"},
    )


@router.get("/export/matrix.csv")
async def export_matrix_csv(_: UserPublic = Depends(get_current_user)):
    """Attendee x Event matrix (P/A/-) — a full attendance register."""
    db = get_database()
    events = await db.events.find().sort("date", 1).to_list(2000)
    attendees = await db.attendees.find().sort("name", 1).to_list(5000)
    marks = await db.attendance.find().to_list(50000)
    lookup = {(m["event_id"], m["attendee_id"]): m["status"] for m in marks}

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    header = ["Name", "Group"] + [f'{e["title"]} ({_event_date_str(e["date"])})' for e in events]
    writer.writerow(header)
    for a in attendees:
        aid = str(a["_id"])
        row = [a["name"], a.get("group") or ""]
        for e in events:
            st = lookup.get((str(e["_id"]), aid))
            row.append({"present": "P", "absent": "A"}.get(st, "-"))
        writer.writerow(row)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_matrix.csv"},
    )
