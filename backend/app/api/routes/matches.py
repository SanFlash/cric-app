from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.org import User, Player
from app.models.match import Innings, Match
from app.models.enums import UserRole, DeliveryOutcome, DismissalType
from app.services.scoring_service import ScoringService, BallInput, current_batters_after
from app.services.prediction_engine import PredictionEngine
from app.ws.live_match import manager

router = APIRouter(prefix="/matches", tags=["matches"])


class DeliveryIn(BaseModel):
    innings_id: int
    striker_id: int
    non_striker_id: int
    bowler_id: int
    outcome: DeliveryOutcome
    extra_runs: int = 0
    is_wicket: bool = False
    dismissal_type: DismissalType | None = None
    dismissed_player_id: int | None = None
    fielder_id: int | None = None


def _scoreboard_payload(db: Session, innings: Innings) -> dict:
    return {
        "type": "scoreboard_update",
        "match_id": innings.match_id,
        "innings_id": innings.id,
        "innings_number": innings.innings_number,
        "score": f"{innings.total_runs}/{innings.total_wickets}",
        "overs": innings.overs_display,
        "run_rate": innings.run_rate,
        "target": innings.target,
        "is_completed": innings.is_completed,
    }


@router.post(
    "/deliveries",
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.CAPTAIN, UserRole.UMPIRE))],
)
async def score_delivery(payload: DeliveryIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    service = ScoringService(db)
    try:
        ball = BallInput(**payload.model_dump(exclude={"innings_id"}))
        delivery = service.record_delivery(payload.innings_id, ball)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    innings = db.get(Innings, payload.innings_id)
    payload_out = _scoreboard_payload(db, innings)

    # Event data for animation (both the scorer's own screen and every
    # connected viewer replay the same animation off this same broadcast —
    # it's not computed client-side, so everyone sees the same thing at the
    # same moment). over_completed additionally signals "prompt for a new
    # bowler" to the scorer.
    over_just_completed = delivery.is_legal_delivery and delivery.ball_in_over == 6 and not innings.is_completed
    current_striker_id, current_non_striker_id = current_batters_after(delivery)

    def _player_brief(player_id: int | None) -> dict | None:
        if player_id is None:
            return None
        p = db.get(Player, player_id)
        if not p:
            return None
        return {"id": p.id, "full_name": p.full_name, "profile_image_url": p.profile_image_url}

    payload_out["event"] = {
        "delivery_id": delivery.id,
        "innings_id": delivery.innings_id,
        "outcome": delivery.outcome.value,
        "is_wicket": delivery.is_wicket,
        "dismissal_type": delivery.dismissal_type.value if delivery.dismissal_type else None,
        "runs_batter": delivery.runs_batter,
        "over_completed": over_just_completed,
        "previous_bowler_id": delivery.bowler_id if over_just_completed else None,
        # Who batted THIS specific ball — historically accurate, never
        # rotated. Used for e.g. "who got dismissed" logic.
        "striker": _player_brief(delivery.striker_id),
        "non_striker": _player_brief(delivery.non_striker_id),
        "bowler": _player_brief(delivery.bowler_id),
        "dismissed_player": _player_brief(delivery.dismissed_player_id),
        "fielder": _player_brief(delivery.fielder_id),
        # Who's actually on strike for the NEXT ball — accounts for
        # odd-run/end-of-over rotation. This is what "who's currently
        # batting" displays and reconnect/reopen restoration should use;
        # the plain striker/non_striker fields above are the pre-rotation
        # historical record of this one delivery, not the current state.
        "current_striker": _player_brief(current_striker_id),
        "current_non_striker": _player_brief(current_non_striker_id),
    }

    # Live Win Predictor (section 15) — recalculate after every ball once the
    # chase is underway; no-op (returns None) during the 1st innings.
    prediction = PredictionEngine(db).compute_live(innings.match_id)
    if prediction:
        db.commit()
        payload_out["win_probability"] = {
            "team_a_pct": prediction.team_a_win_pct,
            "team_b_pct": prediction.team_b_win_pct,
            "context": prediction.context,
        }

    await manager.broadcast(innings.match_id, payload_out)
    return {"delivery_id": delivery.id, "scoreboard": payload_out}
