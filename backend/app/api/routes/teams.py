from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, require_roles, require_company_scope
from app.models.org import Team, Company, User
from app.models.invite import TeamInvite
from app.models.enums import UserRole
from app.core.config import settings

router = APIRouter(prefix="/teams", tags=["teams"])


class TeamCreate(BaseModel):
    company_id: int
    name: str
    logo_url: str | None = None
    coach_name: str | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    coach_name: str | None = None


class TeamOut(BaseModel):
    id: int
    company_id: int
    name: str
    logo_url: str | None
    coach_name: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[TeamOut])
def list_teams(company_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Team).filter(Team.is_deleted.is_(False))
    if company_id:
        q = q.filter(Team.company_id == company_id)
    return q.all()


@router.get("/{team_id}", response_model=TeamOut)
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if not team or team.is_deleted:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.post(
    "",
    response_model=TeamOut,
    status_code=201,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
def create_team(payload: TeamCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_company_scope(user, payload.company_id)
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    team = Team(**payload.model_dump())
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"A team named '{payload.name}' already exists in this company.")
    db.refresh(team)
    return team


@router.patch(
    "/{team_id}",
    response_model=TeamOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.CAPTAIN))],
)
def update_team(team_id: int, payload: TeamUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Logo/coach/name updates. A captain may only update the team they were
    scoped to via their invite (User.team_id) — admins can update any team
    in their own company.
    """
    team = db.get(Team, team_id)
    if not team or team.is_deleted:
        raise HTTPException(status_code=404, detail="Team not found")

    if user.role == UserRole.CAPTAIN:
        if user.team_id != team_id:
            raise HTTPException(status_code=403, detail="Captains may only manage their own team")
    else:
        require_company_scope(user, team.company_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    db.commit()
    db.refresh(team)
    return team


@router.delete(
    "/{team_id}",
    status_code=204,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
def delete_team(team_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Soft-delete only — never hard-deletes, since Match/Innings/Delivery
    rows reference teams by foreign key. Blocked (400) while the team
    still has active players, rather than silently orphaning their
    team_id — the admin removes/transfers players first, same as most
    real admin tools require before letting you delete a parent record.
    """
    from datetime import datetime, timezone
    from app.models.org import Player

    team = db.get(Team, team_id)
    if not team or team.is_deleted:
        raise HTTPException(status_code=404, detail="Team not found")
    require_company_scope(user, team.company_id)

    active_players = db.query(Player).filter(Player.team_id == team_id, Player.is_deleted.is_(False)).count()
    if active_players > 0:
        raise HTTPException(
            status_code=400,
            detail=f"This team still has {active_players} player(s). Remove or transfer them before deleting the team.",
        )

    team.is_deleted = True
    team.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return None


class InviteOut(BaseModel):
    token: str
    invite_url: str
    expires_at: str


@router.post(
    "/{team_id}/invites",
    response_model=InviteOut,
    status_code=201,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
def create_team_invite(team_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Section 22/29-adjacent: generate a shareable, single-use link an admin
    can hand to a team captain. Visiting /join/{token} on the frontend lets
    the captain create their own account, scoped to this team, and start
    managing roster + logo immediately — no admin-created password to relay.
    """
    team = db.get(Team, team_id)
    if not team or team.is_deleted:
        raise HTTPException(status_code=404, detail="Team not found")
    require_company_scope(user, team.company_id)

    invite = TeamInvite(team_id=team_id, created_by_user_id=user.id)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return InviteOut(
        token=invite.token,
        invite_url=f"/join/{invite.token}",
        expires_at=invite.expires_at.isoformat(),
    )
