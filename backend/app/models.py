import datetime as dt
from datetime import datetime
from enum import Enum
from typing import Annotated, Any

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, EmailStr, Field

# Represent MongoDB ObjectId as a string in all API payloads.
PyObjectId = Annotated[str, BeforeValidator(str)]


class Role(str, Enum):
    admin = "admin"
    coordinator = "coordinator"


class AttendanceStatus(str, Enum):
    present = "present"
    absent = "absent"


# ---------- Users ----------
class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    role: Role = Role.coordinator


class UserCreate(UserBase):
    # Optional: omit to invite a Google-only account (sign-in via Google,
    # no password). Provide one to also enable email + password login.
    password: str | None = Field(default=None, min_length=6, max_length=128)


class UserPublic(UserBase):
    id: PyObjectId
    created_at: datetime
    has_password: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    # The ID token (JWT) returned by Google Identity Services on the client.
    credential: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------- Attendees (participants) ----------
class AttendeeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    gender: str | None = None
    group: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    active: bool = True


class AttendeeCreate(AttendeeBase):
    pass


class AttendeeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    gender: str | None = None
    group: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    active: bool | None = None


class AttendeePublic(AttendeeBase):
    id: PyObjectId
    created_at: datetime


# ---------- Events ----------
class Speaker(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    topic: str | None = Field(default=None, max_length=200)


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    date: dt.date
    location: str | None = Field(default=None, max_length=160)
    theme: str | None = Field(default=None, max_length=200)
    host: str | None = Field(default=None, max_length=120)
    speakers: list[Speaker] = Field(default_factory=list, max_length=5)
    activity: str | None = Field(default=None, max_length=300)
    notes: str | None = Field(default=None, max_length=1000)


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    date: dt.date | None = None
    location: str | None = Field(default=None, max_length=160)
    theme: str | None = Field(default=None, max_length=200)
    host: str | None = Field(default=None, max_length=120)
    speakers: list[Speaker] | None = Field(default=None, max_length=5)
    activity: str | None = Field(default=None, max_length=300)
    notes: str | None = Field(default=None, max_length=1000)


class EventPublic(EventBase):
    id: PyObjectId
    created_at: datetime
    present_count: int = 0
    absent_count: int = 0


# ---------- Attendance ----------
class AttendanceMark(BaseModel):
    attendee_id: str
    status: AttendanceStatus


class BulkAttendance(BaseModel):
    records: list[AttendanceMark]


class AttendancePublic(BaseModel):
    id: PyObjectId
    event_id: str
    attendee_id: str
    status: AttendanceStatus
    marked_by: str | None = None
    marked_at: datetime


def serialize(doc: dict[str, Any]) -> dict[str, Any]:
    """Stringify ObjectId fields and rename _id -> id for API output."""
    if doc is None:
        return doc
    out = dict(doc)
    for key, value in list(out.items()):
        if isinstance(value, ObjectId):
            out[key] = str(value)
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out


def user_public(doc: dict[str, Any]) -> "UserPublic":
    """Build a UserPublic from a raw user document (adds has_password)."""
    data = serialize(doc)
    data["has_password"] = bool(doc.get("hashed_password"))
    return UserPublic(**data)
