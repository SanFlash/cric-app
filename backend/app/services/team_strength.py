"""
TeamStrengthCalculator (section 13). Computes team strength from a specific
set of players — normally the current Playing XI for a match, but callable
with any player_id list (e.g. the full squad) so it can also answer
"how strong is our full roster" for planning purposes.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.org import Player
from app.models.performance import TeamRating
from app.models.enums import PlayingRole
from app.services.performance_engine import PerformanceEngine, _clamp


@dataclass
class TeamStrengthBreakdown:
    batting_strength: float
    bowling_strength: float
    allround_strength: float
    fielding_strength: float
    recent_form_strength: float
    bench_strength: float
    overall_strength: float


class TeamStrengthCalculator:
    def __init__(self, db: Session):
        self.db = db
        self.perf = PerformanceEngine(db)

    def compute(self, team_id: int, xi_player_ids: list[int], bench_player_ids: list[int] | None = None) -> TeamStrengthBreakdown:
        players = self.db.query(Player).filter(Player.id.in_(xi_player_ids)).all()
        if not players:
            return TeamStrengthBreakdown(0, 0, 0, 0, 0, 0, 0)

        batters = [p for p in players if p.playing_role in
                   (PlayingRole.BATTER, PlayingRole.ALL_ROUNDER, PlayingRole.WICKETKEEPER)]
        bowlers = [p for p in players if p.playing_role in (PlayingRole.BOWLER, PlayingRole.ALL_ROUNDER)]
        all_rounders = [p for p in players if p.playing_role == PlayingRole.ALL_ROUNDER]

        def avg_batting_rating(pool: list[Player]) -> float:
            scores = [self.perf.batting_metrics(p.id).average_score for p in pool]
            scores = [s for s in scores if s > 0] or [0.0]
            return round(sum(scores) / len(scores), 1)

        def avg_bowling_rating(pool: list[Player]) -> float:
            scores = [self.perf.bowling_metrics(p.id).economy_score for p in pool]
            scores = [s for s in scores if s > 0] or [0.0]
            return round(sum(scores) / len(scores), 1)

        batting_strength = avg_batting_rating(batters) if batters else 0.0
        bowling_strength = avg_bowling_rating(bowlers) if bowlers else 0.0
        allround_strength = round(
            sum(p.current_rating for p in all_rounders) / len(all_rounders), 1
        ) if all_rounders else 0.0

        fielding_scores = [self.perf.fielding_metrics(p.id).efficiency_score for p in players]
        fielding_strength = round(sum(fielding_scores) / len(fielding_scores), 1) if fielding_scores else 0.0

        form_scores = [p.current_form_score for p in players]
        recent_form_strength = round(sum(form_scores) / len(form_scores), 1) if form_scores else 0.0

        bench_strength = 0.0
        if bench_player_ids:
            bench_players = self.db.query(Player).filter(Player.id.in_(bench_player_ids)).all()
            bench_ratings = [p.current_rating for p in bench_players]
            bench_strength = round(sum(bench_ratings) / len(bench_ratings), 1) if bench_ratings else 0.0

        # Overall = average of the four core pillars (bench is informational, not counted
        # in "how strong is this XI right now" — it reflects squad depth, a separate concern)
        pillars = [batting_strength, bowling_strength, fielding_strength, recent_form_strength]
        overall = round(sum(pillars) / len(pillars), 1)

        return TeamStrengthBreakdown(
            batting_strength=batting_strength, bowling_strength=bowling_strength,
            allround_strength=allround_strength, fielding_strength=fielding_strength,
            recent_form_strength=recent_form_strength, bench_strength=bench_strength,
            overall_strength=overall,
        )

    def compute_and_record(self, team_id: int, xi_player_ids: list[int],
                            bench_player_ids: list[int] | None = None) -> TeamRating:
        breakdown = self.compute(team_id, xi_player_ids, bench_player_ids)
        snapshot = TeamRating(
            team_id=team_id, computed_at=datetime.now(timezone.utc),
            batting_strength=breakdown.batting_strength, bowling_strength=breakdown.bowling_strength,
            allround_strength=breakdown.allround_strength, fielding_strength=breakdown.fielding_strength,
            recent_form_strength=breakdown.recent_form_strength, bench_strength=breakdown.bench_strength,
            overall_strength=breakdown.overall_strength,
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot
