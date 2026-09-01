"""
Match scheduling (previously missing entirely — only ball-by-ball scoring
existed, with no way to create the match/innings being scored into).
Creating a match also creates both Innings rows up front: Innings 2's
target can only be set once Innings 1 completes, and the live-scoreboard
WS snapshot logic already expects both rows to exist from match start.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import require_roles
from app.models.org import Team, Squad, SquadPlayer, Player
from app.models.match import Match, Innings
from app.models.enums import UserRole, MatchStatus, TossDecision

router = APIRouter(prefix="/matches", tags=["matches"])

SCORER_ROLES = (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.CAPTAIN, UserRole.UMPIRE)


class MatchCreate(BaseModel):
    team_a_id: int
    team_b_id: int
    scheduled_at: datetime
    overs_limit: int = 20
    tournament_id: int | None = None
    venue_id: int | None = None
    squad_a_id: int | None = None
    squad_b_id: int | None = None
    toss_winner_team_id: int | None = None
    toss_decision: TossDecision | None = None
    umpire_names: str | None = None


class MatchOut(BaseModel):
    id: int
    team_a_id: int
    team_b_id: int
    scheduled_at: datetime
    overs_limit: int
    status: MatchStatus
    tournament_id: int | None
    squad_a_id: int | None
    squad_b_id: int | None
    toss_winner_team_id: int | None
    toss_decision: TossDecision | None
    winner_team_id: int | None
    result_summary: str | None

    class Config:
        from_attributes = True


class InningsOut(BaseModel):
    id: int
    innings_number: int
    batting_team_id: int
    bowling_team_id: int
    total_runs: int
    total_wickets: int
    total_balls: int
    is_completed: bool
    target: int | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[MatchOut])
def list_matches(status: MatchStatus | None = None, team_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Match)
    if status is not None:
        q = q.filter(Match.status == status)
    if team_id is not None:
        q = q.filter((Match.team_a_id == team_id) | (Match.team_b_id == team_id))
    return q.order_by(Match.scheduled_at.desc()).all()


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.get("/{match_id}/innings", response_model=list[InningsOut])
def get_match_innings(match_id: int, db: Session = Depends(get_db)):
    if not db.get(Match, match_id):
        raise HTTPException(status_code=404, detail="Match not found")
    return db.query(Innings).filter(Innings.match_id == match_id).order_by(Innings.innings_number).all()


@router.post("", response_model=MatchOut, status_code=201, dependencies=[Depends(require_roles(*SCORER_ROLES))])
def create_match(payload: MatchCreate, db: Session = Depends(get_db)):
    if payload.team_a_id == payload.team_b_id:
        raise HTTPException(status_code=400, detail="A team cannot play itself.")
    team_a = db.get(Team, payload.team_a_id)
    team_b = db.get(Team, payload.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=404, detail="One or both teams not found.")

    for squad_id, team_id, label in [
        (payload.squad_a_id, payload.team_a_id, "Team A"), (payload.squad_b_id, payload.team_b_id, "Team B"),
    ]:
        if squad_id is None:
            continue
        squad = db.get(Squad, squad_id)
        if not squad:
            raise HTTPException(status_code=404, detail=f"{label} squad not found.")
        if squad.team_id != team_id:
            raise HTTPException(status_code=400, detail=f"Selected squad does not belong to {label}.")

    match = Match(
        team_a_id=payload.team_a_id, team_b_id=payload.team_b_id, scheduled_at=payload.scheduled_at,
        overs_limit=payload.overs_limit, tournament_id=payload.tournament_id, venue_id=payload.venue_id,
        squad_a_id=payload.squad_a_id, squad_b_id=payload.squad_b_id,
        toss_winner_team_id=payload.toss_winner_team_id, toss_decision=payload.toss_decision,
        umpire_names=payload.umpire_names, status=MatchStatus.LIVE,
    )
    db.add(match)
    db.flush()

    # Decide who bats first: toss winner's decision if provided, else team A.
    bat_first, bowl_first = team_a.id, team_b.id
    if payload.toss_winner_team_id and payload.toss_decision:
        if payload.toss_decision == TossDecision.BAT:
            bat_first, bowl_first = payload.toss_winner_team_id, (
                team_b.id if payload.toss_winner_team_id == team_a.id else team_a.id
            )
        else:  # toss winner chose to bowl -> the other team bats first
            bowl_first = payload.toss_winner_team_id
            bat_first = team_b.id if payload.toss_winner_team_id == team_a.id else team_a.id

    innings1 = Innings(match_id=match.id, innings_number=1, batting_team_id=bat_first, bowling_team_id=bowl_first)
    innings2 = Innings(match_id=match.id, innings_number=2, batting_team_id=bowl_first, bowling_team_id=bat_first)
    db.add_all([innings1, innings2])
    db.commit()
    db.refresh(match)
    return match


@router.get("/{match_id}/roster")
def get_match_roster(match_id: int, team_id: int, db: Session = Depends(get_db)):
    """
    Players eligible to be selected for `team_id` in this match's Scorer.
    Scoped to the match's linked squad for that team if one was set at
    creation (only players marked available); falls back to the full team
    roster otherwise, so matches created without a squad still work.
    """
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if team_id not in (match.team_a_id, match.team_b_id):
        raise HTTPException(status_code=400, detail="Team is not part of this match")

    squad_id = match.squad_a_id if team_id == match.team_a_id else match.squad_b_id
    if squad_id is not None:
        player_ids = [
            sp.player_id for sp in
            db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id, SquadPlayer.is_available.is_(True)).all()
        ]
        players = db.query(Player).filter(Player.id.in_(player_ids), Player.is_deleted.is_(False)).all()
    else:
        players = db.query(Player).filter(Player.team_id == team_id, Player.is_deleted.is_(False)).all()

    return {"squad_scoped": squad_id is not None, "squad_id": squad_id, "player_ids": [p.id for p in players]}


@router.delete(
    "/{match_id}",
    status_code=200,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
def delete_match(match_id: int, db: Session = Depends(get_db)):
    """
    Permanently deletes a match and everything derived from it — every
    delivery, both innings, per-match performance rows, any predictions —
    then recomputes career stats/ratings for every player who played in
    it, and rebuilds tournament standings from the matches that remain,
    so nothing is left over-counting a match that no longer exists.
    Deliberately restricted to admins, not captains/umpires — this is
    irreversible and rewrites real historical numbers, unlike everything
    else in the scoring flow which only ever adds data.
    """
    from app.services.match_deletion_service import MatchDeletionService

    try:
        result = MatchDeletionService(db).delete_match(match_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"deleted": True, **result}
