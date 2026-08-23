from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import require_roles
from app.models.org import Squad, SquadPlayer, Player, Team
from app.models.enums import UserRole
from app.schemas.squad import SquadCreate, SquadOut, SquadPlayerAdd, SquadPlayerOut, AvailabilityUpdate
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/squads", tags=["squads"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.CAPTAIN)


@router.get("", response_model=list[SquadOut])
def list_squads(team_id: int | None = None, tournament_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Squad)
    if team_id is not None:
        q = q.filter(Squad.team_id == team_id)
    if tournament_id is not None:
        q = q.filter(Squad.tournament_id == tournament_id)
    return q.all()


@router.post("", response_model=SquadOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_squad(payload: SquadCreate, db: Session = Depends(get_db)):
    if not db.get(Team, payload.team_id):
        raise HTTPException(status_code=404, detail="Team not found")
    squad = Squad(**payload.model_dump())
    db.add(squad)
    db.commit()
    db.refresh(squad)
    return squad


@router.get("/{squad_id}/players", response_model=list[SquadPlayerOut])
def list_squad_players(squad_id: int, db: Session = Depends(get_db)):
    return db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id).all()


@router.post(
    "/{squad_id}/players", response_model=SquadPlayerOut, status_code=201,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def add_player_to_squad(squad_id: int, payload: SquadPlayerAdd, db: Session = Depends(get_db)):
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(status_code=404, detail="Squad not found")
    player = db.get(Player, payload.player_id)
    if not player or player.is_deleted:
        raise HTTPException(status_code=404, detail="Player not found")
    if player.team_id != squad.team_id:
        raise HTTPException(status_code=400, detail="Player does not belong to this squad's team")

    existing = (
        db.query(SquadPlayer)
        .filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == payload.player_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Player already in this squad")

    sp = SquadPlayer(squad_id=squad_id, player_id=payload.player_id)
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return sp


@router.delete(
    "/{squad_id}/players/{player_id}", status_code=204,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def remove_player_from_squad(squad_id: int, player_id: int, db: Session = Depends(get_db)):
    sp = (
        db.query(SquadPlayer)
        .filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == player_id)
        .first()
    )
    if not sp:
        raise HTTPException(status_code=404, detail="Player not in this squad")
    db.delete(sp)
    db.commit()
    return None


@router.patch(
    "/{squad_id}/players/{player_id}/availability", response_model=SquadPlayerOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES, UserRole.PLAYER))],
)
def set_availability(squad_id: int, player_id: int, payload: AvailabilityUpdate, db: Session = Depends(get_db)):
    """A player can mark their own availability (section 3: Player role can
    'mark availability'); admins/captains can mark it for anyone."""
    sp = (
        db.query(SquadPlayer)
        .filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == player_id)
        .first()
    )
    if not sp:
        raise HTTPException(status_code=404, detail="Player not in this squad")
    sp.is_available = payload.is_available
    sp.unavailability_reason = payload.unavailability_reason
    db.commit()
    db.refresh(sp)
    NotificationService(db).notify_unavailable_marked(player_id, squad_id)
    db.commit()
    return sp
