from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.org import Player, Team, User
from app.models.enums import UserRole, PlayerStatus, PlayingRole
from app.schemas.player import PlayerCreate, PlayerUpdate, PlayerOut

router = APIRouter(prefix="/players", tags=["players"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.CAPTAIN)


@router.get("", response_model=list[PlayerOut])
def list_players(
    team_id: int | None = None,
    status: PlayerStatus | None = None,
    playing_role: PlayingRole | None = None,
    search: str | None = Query(default=None, description="Search by name or employee ID"),
    db: Session = Depends(get_db),
):
    q = db.query(Player).filter(Player.is_deleted.is_(False))
    if team_id is not None:
        q = q.filter(Player.team_id == team_id)
    if status is not None:
        q = q.filter(Player.status == status)
    if playing_role is not None:
        q = q.filter(Player.playing_role == playing_role)
    if search:
        like = f"%{search}%"
        q = q.filter((Player.full_name.ilike(like)) | (Player.employee_id.ilike(like)))
    return [PlayerOut.from_player(p) for p in q.order_by(Player.full_name).all()]


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player or player.is_deleted:
        raise HTTPException(status_code=404, detail="Player not found")
    return PlayerOut.from_player(player)


@router.post(
    "", response_model=PlayerOut, status_code=201,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def create_player(payload: PlayerCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == UserRole.CAPTAIN:
        if payload.team_id is not None and payload.team_id != user.team_id:
            raise HTTPException(status_code=403, detail="Captains may only add players to their own team")
        payload = payload.model_copy(update={"team_id": user.team_id})

    if payload.team_id and not db.get(Team, payload.team_id):
        raise HTTPException(status_code=404, detail="Team not found")
    if payload.jersey_number is not None and payload.team_id:
        clash = (
            db.query(Player)
            .filter(Player.team_id == payload.team_id, Player.jersey_number == payload.jersey_number,
                     Player.is_deleted.is_(False))
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail=f"Jersey #{payload.jersey_number} already taken on this team")

    player = Player(**payload.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return PlayerOut.from_player(player)


@router.patch(
    "/{player_id}", response_model=PlayerOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def update_player(player_id: int, payload: PlayerUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    player = db.get(Player, player_id)
    if not player or player.is_deleted:
        raise HTTPException(status_code=404, detail="Player not found")
    if user.role == UserRole.CAPTAIN and player.team_id != user.team_id:
        raise HTTPException(status_code=403, detail="Captains may only edit players on their own team")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return PlayerOut.from_player(player)


@router.post(
    "/{player_id}/transfer", response_model=PlayerOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
def transfer_player(player_id: int, new_team_id: int, db: Session = Depends(get_db)):
    """Move a player to a different team, preserving all career stats (which
    live on the Player row, not the Team, so nothing needs to be recalculated)."""
    player = db.get(Player, player_id)
    if not player or player.is_deleted:
        raise HTTPException(status_code=404, detail="Player not found")
    if not db.get(Team, new_team_id):
        raise HTTPException(status_code=404, detail="Target team not found")
    player.team_id = new_team_id
    db.commit()
    db.refresh(player)
    return PlayerOut.from_player(player)


@router.delete(
    "/{player_id}", status_code=204,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
def delete_player(player_id: int, db: Session = Depends(get_db)):
    """Soft-delete only — a player with match history must never be hard-deleted,
    since Delivery/Performance rows reference them by foreign key."""
    from datetime import datetime, timezone
    player = db.get(Player, player_id)
    if not player or player.is_deleted:
        raise HTTPException(status_code=404, detail="Player not found")
    player.is_deleted = True
    player.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return None
