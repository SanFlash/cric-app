from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date

from app.core.database import get_db
from app.api.deps import require_roles
from app.models.tournament import Tournament, TournamentStanding
from app.models.org import Company
from app.models.enums import UserRole, TournamentFormat
from app.services.tournament_service import TournamentService

router = APIRouter(prefix="/tournaments", tags=["tournaments"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)


class TournamentCreate(BaseModel):
    company_id: int
    name: str
    format: TournamentFormat
    season_label: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class TournamentOut(BaseModel):
    id: int
    company_id: int
    name: str
    format: TournamentFormat
    season_label: str | None
    start_date: date | None
    end_date: date | None

    class Config:
        from_attributes = True


class StandingOut(BaseModel):
    team_id: int
    played: int
    won: int
    lost: int
    tied: int
    no_result: int
    points: int
    net_run_rate: float

    class Config:
        from_attributes = True


@router.get("", response_model=list[TournamentOut])
def list_tournaments(company_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Tournament)
    if company_id is not None:
        q = q.filter(Tournament.company_id == company_id)
    return q.order_by(Tournament.start_date.desc().nullslast()).all()


@router.post("", response_model=TournamentOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_tournament(payload: TournamentCreate, db: Session = Depends(get_db)):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    tournament = Tournament(**payload.model_dump())
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


@router.get("/{tournament_id}/standings", response_model=list[StandingOut])
def get_standings(tournament_id: int, db: Session = Depends(get_db)):
    """Points table, sorted points desc then NRR desc (section 19)."""
    if not db.get(Tournament, tournament_id):
        raise HTTPException(status_code=404, detail="Tournament not found")
    return TournamentService(db).get_points_table(tournament_id)
