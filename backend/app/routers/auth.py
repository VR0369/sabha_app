from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..config import settings
from ..database import get_database
from ..models import (
    GoogleLoginRequest,
    LoginRequest,
    Role,
    Token,
    UserCreate,
    UserPublic,
    user_public,
)
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_google_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _authenticate(email: str, password: str) -> dict:
    db = get_database()
    doc = await db.users.find_one({"email": email.lower()})
    if not doc or not doc.get("hashed_password") or not verify_password(
        password, doc["hashed_password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return doc


def _build_token(doc: dict) -> Token:
    user = user_public(doc)
    token = create_access_token(subject=str(doc["_id"]), role=doc["role"])
    return Token(access_token=token, user=user)


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest):
    doc = await _authenticate(payload.email.lower(), payload.password)
    return _build_token(doc)


@router.post("/token", response_model=Token)
async def login_form(form: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 password-flow endpoint (used by Swagger's Authorize button)."""
    doc = await _authenticate(form.username.lower(), form.password)
    return _build_token(doc)


@router.post("/google", response_model=Token)
async def google_login(payload: GoogleLoginRequest):
    """Sign in with a Google ID token.

    Access is restricted to pre-approved emails: an admin must have invited the
    account on the Users page first. The configured primary admin is always
    allowed and is (re)granted the admin role automatically.
    """
    info = verify_google_token(payload.credential)
    email = info["email"].lower()
    name = info.get("name") or email.split("@")[0]
    sub = info.get("sub")
    is_primary = email == settings.primary_admin_email.lower().strip()

    db = get_database()
    doc = await db.users.find_one({"email": email})

    if not doc:
        if not is_primary:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This Google account is not approved. Ask an admin to invite you.",
            )
        doc = {
            "name": name,
            "email": email,
            "role": Role.admin.value,
            "google_sub": sub,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
    else:
        updates = {}
        if sub and doc.get("google_sub") != sub:
            updates["google_sub"] = sub
        if is_primary and doc.get("role") != Role.admin.value:
            updates["role"] = Role.admin.value
        if updates:
            await db.users.update_one({"_id": doc["_id"]}, {"$set": updates})
            doc.update(updates)

    return _build_token(doc)


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, _: UserPublic = Depends(require_admin)):
    """Only admins can create new staff accounts (admins or coordinators).

    Omit the password to invite a Google-only account (the person then signs in
    with Google); provide one to also enable email + password login.
    """
    db = get_database()
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "role": payload.role.value,
        "created_at": datetime.now(timezone.utc),
    }
    if payload.password:
        doc["hashed_password"] = hash_password(payload.password)
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return user_public(doc)


@router.get("/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[UserPublic])
async def list_users(_: UserPublic = Depends(require_admin)):
    db = get_database()
    docs = await db.users.find().sort("created_at", -1).to_list(500)
    return [user_public(d) for d in docs]
