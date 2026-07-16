from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..database import get_database
from ..models import LoginRequest, Role, Token, UserCreate, UserPublic, serialize
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _authenticate(email: str, password: str) -> dict:
    db = get_database()
    doc = await db.users.find_one({"email": email.lower()})
    if not doc or not verify_password(password, doc["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return doc


def _build_token(doc: dict) -> Token:
    user = UserPublic(**serialize(doc))
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


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, _: UserPublic = Depends(require_admin)):
    """Only admins can create new staff accounts (admins or coordinators)."""
    db = get_database()
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "role": payload.role.value,
        "hashed_password": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return UserPublic(**serialize(doc))


@router.get("/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[UserPublic])
async def list_users(_: UserPublic = Depends(require_admin)):
    db = get_database()
    docs = await db.users.find().sort("created_at", -1).to_list(500)
    return [UserPublic(**serialize(d)) for d in docs]
