from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.services.leaderboard_service import LeaderboardService

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])


class LeaderboardEntryOut(BaseModel):
    player_id: int
    full_name: str
    value: float
    secondary: str | None = None


BATTING_METRICS = {
    "most_runs": "most_runs", "highest_score": "highest_score", "best_average": "best_average",
    "best_strike_rate": "best_strike_rate", "most_sixes": "most_sixes", "most_fours": "most_fours",
}
BOWLING_METRICS = {"most_wickets": "most_wickets", "best_economy": "best_economy", "best_bowling": "best_bowling_figures"}
FIELDING_METRICS = {"most_catches": "most_catches", "most_run_outs": "most_run_outs", "most_stumpings": "most_stumpings"}
OVERALL_METRICS = {"best_form": "best_current_form", "best_overall": "best_overall_rating"}

ALL_METRICS = {**BATTING_METRICS, **BOWLING_METRICS, **FIELDING_METRICS, **OVERALL_METRICS}


@router.get("/{metric}", response_model=list[LeaderboardEntryOut])
def get_leaderboard(
    metric: str,
    tournament_id: int | None = None,
    team_id: int | None = None,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """
    Section 20. `metric` is one of:
      batting:  most_runs, highest_score, best_average, best_strike_rate, most_sixes, most_fours
      bowling:  most_wickets, best_economy, best_bowling
      fielding: most_catches, most_run_outs, most_stumpings
      overall:  best_form, best_overall
    `tournament_id`/`team_id` filter batting/bowling/fielding metrics (section 20's
    Tournament/Team filters); overall metrics are career-wide by design.
    """
    if metric not in ALL_METRICS:
        raise HTTPException(status_code=404, detail=f"Unknown metric '{metric}'. Valid: {sorted(ALL_METRICS)}")

    service = LeaderboardService(db)
    method = getattr(service, ALL_METRICS[metric])

    if metric in OVERALL_METRICS:
        results = method(limit=limit)
    else:
        results = method(tournament_id=tournament_id, team_id=team_id, limit=limit)

    return [LeaderboardEntryOut(**r.__dict__) for r in results]
