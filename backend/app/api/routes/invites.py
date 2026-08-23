"""
Public routes (no auth) for the captain self-onboarding flow: view what
team an invite is for, then accept it to create a captain account scoped
to that team in one step. Deliberately unauthenticated — the token itself
is the credential, same pattern as a password-reset link.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.core.database import get_db
from app.models.org import Team, User
from app.models.invite import TeamInvite
from app.models.enums import UserRole
from app.core.security import hash_password, create_access_token, create_refresh_token

router = APIRouter(prefix="/invites", tags=["invites"])


class InviteDetailsOut(BaseModel):
    valid: bool
    team_name: str | None = None
    team_id: int | None = None
    reason: str | None = None  # populated when valid=False, e.g. "expired" / "already used"


@router.get("/{token}", response_model=InviteDetailsOut)
def get_invite(token: str, db: Session = Depends(get_db)):
    invite = db.query(TeamInvite).filter(TeamInvite.token == token).first()
    if not invite:
        return InviteDetailsOut(valid=False, reason="not_found")
    if invite.used_at is not None:
        return InviteDetailsOut(valid=False, reason="already_used")
    if not invite.is_valid:
        return InviteDetailsOut(valid=False, reason="expired")
    team = db.get(Team, invite.team_id)
    return InviteDetailsOut(valid=True, team_name=team.name if team else None, team_id=invite.team_id)


class InviteAcceptIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    team_logo_url: str | None = None  # optional: set the team's logo in the same step


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    team_id: int


@router.post("/{token}/accept", response_model=TokenPairOut)
def accept_invite(token: str, payload: InviteAcceptIn, db: Session = Depends(get_db)):
    invite = db.query(TeamInvite).filter(TeamInvite.token == token).first()
    if not invite or not invite.is_valid:
        raise HTTPException(status_code=400, detail="This invite link is invalid, expired, or already used.")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists — log in instead.")

    team = db.get(Team, invite.team_id)
    if not team or team.is_deleted:
        raise HTTPException(status_code=404, detail="Team not found")

    captain = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.CAPTAIN,
        company_id=team.company_id,
        team_id=team.id,
    )
    db.add(captain)
    db.flush()

    if payload.team_logo_url:
        team.logo_url = payload.team_logo_url

    invite.used_at = captain.created_at
    invite.used_by_user_id = captain.id
    db.commit()
    db.refresh(captain)

    return TokenPairOut(
        access_token=create_access_token(captain.id, captain.role.value),
        refresh_token=create_refresh_token(captain.id),
        team_id=team.id,
    )
