from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.performance import PlayerRating, PlayerForm
from app.models.match import PlayingXI
from app.models.org import Player, SquadPlayer
from app.services.rating_engine import RatingEngine
from app.services.form_engine import FormEngine
from app.services.team_strength import TeamStrengthCalculator
from app.services.prediction_engine import PredictionEngine
from app.services.xi_recommendation import XIRecommendationEngine
from app.services.achievement_engine import AchievementEngine
from app.services.insight_engine import InsightEngine
from app.services.match_summary_engine import MatchSummaryEngine
from app.models.performance import Prediction
from app.schemas.analytics import PlayerCompareOut, PlayerCompareRow, XIRecommendationOut, XISlotOut

router = APIRouter(prefix="/analytics", tags=["analytics"])


class RatingOut(BaseModel):
    player_id: int
    batting_rating: float
    bowling_rating: float
    fielding_rating: float
    form_rating: float
    consistency_rating: float
    pressure_rating: float
    overall_rating: float

    class Config:
        from_attributes = True


class FormPointOut(BaseModel):
    match_id: int
    computed_at: str
    form_score: float
    batting_form: float
    bowling_form: float
    match_impact_score: float


class TeamStrengthOut(BaseModel):
    team_id: int
    batting_strength: float
    bowling_strength: float
    allround_strength: float
    fielding_strength: float
    recent_form_strength: float
    bench_strength: float
    overall_strength: float


@router.get("/players/{player_id}/rating", response_model=RatingOut)
def get_player_rating(player_id: int, recompute: bool = False, db: Session = Depends(get_db)):
    if recompute:
        breakdown = RatingEngine(db).compute_and_record(player_id)
        db.commit()
        return RatingOut(player_id=player_id, **breakdown.__dict__)

    latest = (
        db.query(PlayerRating)
        .filter(PlayerRating.player_id == player_id)
        .order_by(PlayerRating.computed_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No rating computed yet for this player — pass ?recompute=true")
    return RatingOut(player_id=player_id, **{
        k: getattr(latest, k) for k in
        ["batting_rating", "bowling_rating", "fielding_rating", "form_rating", "consistency_rating",
         "pressure_rating", "overall_rating"]
    })


@router.get("/players/{player_id}/form", response_model=list[FormPointOut])
def get_player_form_timeline(player_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """Form history for the form graph (section 4) — filterable by ?limit=5/10/20."""
    points = FormEngine(db).form_timeline(player_id, limit=limit)
    return [
        FormPointOut(
            match_id=p.match_id, computed_at=p.computed_at.isoformat(), form_score=p.form_score,
            batting_form=p.batting_form, bowling_form=p.bowling_form, match_impact_score=p.match_impact_score,
        )
        for p in points
    ]


@router.get("/teams/{team_id}/strength", response_model=TeamStrengthOut)
def get_team_strength(team_id: int, match_id: int, db: Session = Depends(get_db)):
    """
    Computes team strength from the currently-selected Playing XI for
    `match_id` (section 13: recalculated whenever the XI changes — this
    endpoint is naturally live since it reads the current PlayingXI rows
    rather than a cached value).
    """
    xi_rows = (
        db.query(PlayingXI)
        .filter(PlayingXI.match_id == match_id, PlayingXI.team_id == team_id, PlayingXI.is_substitute.is_(False))
        .all()
    )
    if not xi_rows:
        raise HTTPException(status_code=404, detail="No Playing XI selected for this team in this match yet")
    bench_rows = (
        db.query(PlayingXI)
        .filter(PlayingXI.match_id == match_id, PlayingXI.team_id == team_id, PlayingXI.is_substitute.is_(True))
        .all()
    )
    breakdown = TeamStrengthCalculator(db).compute(
        team_id, [r.player_id for r in xi_rows], [r.player_id for r in bench_rows]
    )
    return TeamStrengthOut(team_id=team_id, **breakdown.__dict__)


@router.get("/teams/{team_id}/roster-strength", response_model=TeamStrengthOut)
def get_team_roster_strength(team_id: int, db: Session = Depends(get_db)):
    """
    Team strength computed from the team's whole current roster — no
    match or Playing XI required, unlike /teams/{id}/strength above.
    Meant for "how strong is this team right now" outside match context:
    right after creating a team and assigning players, or any time on
    Team Detail. Genuinely live — reads whichever players currently
    have team_id set to this team, so it updates as the roster changes.
    """
    players = db.query(Player).filter(Player.team_id == team_id, Player.is_deleted.is_(False)).all()
    if not players:
        raise HTTPException(status_code=404, detail="This team has no players yet")
    breakdown = TeamStrengthCalculator(db).compute(team_id, [p.id for p in players])
    return TeamStrengthOut(team_id=team_id, **breakdown.__dict__)


class TeamCompareOut(BaseModel):
    team_a_id: int
    team_b_id: int
    team_a_win_pct: float
    team_b_win_pct: float
    factors: dict


@router.get("/teams/compare", response_model=TeamCompareOut)
def compare_teams(team_a_id: int, team_b_id: int, db: Session = Depends(get_db)):
    """
    A hypothetical "if these two played today" win-probability split —
    same underlying model as a real pre-match prediction, minus the toss
    factor, and nothing gets persisted. Works for any two teams, doesn't
    require a scheduled match between them — built so a newly-created
    team can show a meaningful win prediction against an existing team
    immediately, without needing to actually schedule a match first.
    """
    if team_a_id == team_b_id:
        raise HTTPException(status_code=400, detail="Pick two different teams to compare")
    result = PredictionEngine(db).compare_teams(team_a_id, team_b_id)
    return TeamCompareOut(
        team_a_id=team_a_id, team_b_id=team_b_id,
        team_a_win_pct=result.team_a_win_pct, team_b_win_pct=result.team_b_win_pct,
        factors=result.factors_payload(),
    )


class PredictionOut(BaseModel):
    match_id: int
    team_a_win_pct: float
    team_b_win_pct: float
    context: str
    factors: dict

    class Config:
        from_attributes = True


@router.post("/matches/{match_id}/predictions/pre-match", response_model=PredictionOut)
def compute_pre_match_prediction(match_id: int, db: Session = Depends(get_db)):
    """Section 14: pre-match win probability with explainable factors.
    Safe to call multiple times (e.g. after toss, after XI changes) — each
    call writes a new snapshot rather than mutating a cached value."""
    prediction = PredictionEngine(db).compute_pre_match(match_id)
    db.commit()
    return prediction


@router.get("/matches/{match_id}/predictions/momentum", response_model=list[PredictionOut])
def get_prediction_momentum(match_id: int, db: Session = Depends(get_db)):
    """Full chronological prediction history — the momentum graph (section 15)."""
    points = PredictionEngine(db).momentum_timeline(match_id)
    if not points:
        raise HTTPException(status_code=404, detail="No predictions computed for this match yet")
    return points


@router.get("/matches/{match_id}/predictions/latest", response_model=PredictionOut)
def get_latest_prediction(match_id: int, db: Session = Depends(get_db)):
    latest = (
        db.query(Prediction)
        .filter(Prediction.match_id == match_id)
        .order_by(Prediction.computed_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No predictions computed for this match yet")
    return latest


@router.get("/players/compare", response_model=PlayerCompareOut)
def compare_players(
    player_ids: str = Query(..., description="Comma-separated player IDs, 2-4 players, e.g. '1,2,3'"),
    db: Session = Depends(get_db),
):
    """Section 17: side-by-side player comparison, up to 4 players."""
    try:
        ids = [int(x) for x in player_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="player_ids must be comma-separated integers")
    if not (2 <= len(ids) <= 4):
        raise HTTPException(status_code=400, detail="Provide between 2 and 4 player_ids to compare")

    players = db.query(Player).filter(Player.id.in_(ids), Player.is_deleted.is_(False)).all()
    if len(players) != len(set(ids)):
        raise HTTPException(status_code=404, detail="One or more players not found")
    by_id = {p.id: p for p in players}

    rows = []
    for pid in ids:  # preserve caller's requested order
        p = by_id[pid]
        rows.append(PlayerCompareRow(
            player_id=p.id, full_name=p.full_name,
            matches=max(p.bat_matches, p.bowl_matches),
            runs=p.bat_runs, average=p.bat_average, strike_rate=p.bat_strike_rate,
            wickets=p.bowl_wickets, economy=p.bowl_economy,
            fielding_dismissals=p.field_catches + p.field_run_outs + p.field_stumpings,
            form=p.current_form_score, overall_rating=p.current_rating,
        ))
    return PlayerCompareOut(players=rows)


@router.get("/squads/{squad_id}/recommend-xi", response_model=XIRecommendationOut)
def recommend_playing_xi(squad_id: int, db: Session = Depends(get_db)):
    """
    Section 18: Smart Playing XI Recommendation. Considers only players
    currently marked available in this squad (section 6's availability
    flag) — an injured or unavailable player is automatically excluded,
    not just deprioritized.
    """
    available_ids = [
        sp.player_id for sp in
        db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id, SquadPlayer.is_available.is_(True)).all()
    ]
    if not available_ids:
        raise HTTPException(status_code=404, detail="No available players found in this squad")

    rec = XIRecommendationEngine(db).recommend(available_ids)
    return XIRecommendationOut(
        slots=[XISlotOut(**s.__dict__) for s in rec.slots],
        bench=[XISlotOut(**s.__dict__) for s in rec.bench],
        warnings=rec.warnings,
        summary=rec.summary,
    )


class AchievementOut(BaseModel):
    code: str
    label: str
    match_id: int | None
    awarded_at: str

    class Config:
        from_attributes = True


@router.get("/players/{player_id}/achievements", response_model=list[AchievementOut])
def get_player_achievements(player_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """Section 24: badge history for a player, most recent first."""
    rows = AchievementEngine(db).player_achievements(player_id, limit=limit)
    return [
        AchievementOut(code=r.code, label=r.label, match_id=r.match_id, awarded_at=r.awarded_at.isoformat())
        for r in rows
    ]


@router.get("/players/{player_id}/insights", response_model=list[str])
def get_player_insights(player_id: int, db: Session = Depends(get_db)):
    """
    Section 26: AI-powered insight sentences. Every number is read live from
    stored statistics — nothing is generated by a language model or invented.
    Returns only insights with enough underlying data to be meaningful;
    an empty list means the player doesn't have enough matches yet, not an error.
    """
    return InsightEngine(db).player_insights(player_id)


class MatchAwardOut(BaseModel):
    player_id: int
    full_name: str
    profile_image_url: str | None
    headline: str
    game_changer_note: str | None


class MatchSummaryOut(BaseModel):
    player_of_the_match: MatchAwardOut | None
    highest_scorer: MatchAwardOut | None
    best_bowler: MatchAwardOut | None


@router.get("/matches/{match_id}/summary", response_model=MatchSummaryOut | None)
def get_match_summary(match_id: int, db: Session = Depends(get_db)):
    """
    Match-completion awards — Player of the Match, highest scorer, best
    bowler — computed from the real per-match BattingPerformance/
    BowlingPerformance rows. Returns null (not an error) if the match
    isn't completed yet, so the frontend can just check for a null
    response rather than handling a 404 specially.
    """
    summary = MatchSummaryEngine(db).compute(match_id)
    if summary is None:
        return None

    def _to_out(award) -> MatchAwardOut | None:
        if award is None:
            return None
        return MatchAwardOut(
            player_id=award.player.id, full_name=award.player.full_name,
            profile_image_url=award.player.profile_image_url,
            headline=award.headline, game_changer_note=award.game_changer_note,
        )

    return MatchSummaryOut(
        player_of_the_match=_to_out(summary.player_of_the_match),
        highest_scorer=_to_out(summary.highest_scorer),
        best_bowler=_to_out(summary.best_bowler),
    )
