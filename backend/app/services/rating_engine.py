"""
RatingEngine combines PerformanceEngine's per-discipline scores with
FormEngine's recency-weighted form into the single 0-100 "Overall Rating"
from spec section 11. Weights come from Settings so admins can retune them
without a code change (section 11: "Weights should be configurable").
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.org import Player
from app.models.performance import PlayerRating, PlayerForm
from app.services.performance_engine import PerformanceEngine, _clamp


@dataclass
class RatingBreakdown:
    batting_rating: float
    bowling_rating: float
    fielding_rating: float
    form_rating: float
    consistency_rating: float
    pressure_rating: float
    overall_rating: float


class RatingEngine:
    def __init__(self, db: Session):
        self.db = db
        self.perf = PerformanceEngine(db)

    def _pressure_score(self, player_id: int) -> float:
        """
        Blends chase performance and death-overs performance into a single
        0-100 pressure-situations score. A player with no chase/death-overs
        sample yet gets a neutral 50 rather than 0, so small-sample players
        aren't unfairly tanked on this one factor.
        """
        bat = self.perf.batting_metrics(player_id)
        bowl = self.perf.bowling_metrics(player_id)

        components = []
        if bat.chase_avg_vs_overall_avg is not None:
            # 1.0 = same as overall avg (score 50); 1.5x or better = 100; 0.5x or worse = 0
            components.append(_clamp(50 + (bat.chase_avg_vs_overall_avg - 1.0) * 100))
        if bat.death_overs_share and bat.sample_size > 0:
            # Scoring a fair share of runs in the death overs is a pressure-positive signal
            components.append(_clamp(bat.death_overs_share * 250))  # 40% share -> 100
        if bowl.death_overs_economy is not None:
            # Lower death-overs run-concession share is better for a bowler
            components.append(_clamp(100 - bowl.death_overs_economy * 250))

        return round(sum(components) / len(components), 1) if components else 50.0

    def compute_and_record(self, player_id: int) -> RatingBreakdown:
        player: Player = self.db.get(Player, player_id)
        bat = self.perf.batting_metrics(player_id)
        bowl = self.perf.bowling_metrics(player_id)
        field = self.perf.fielding_metrics(player_id)
        consistency = self.perf.consistency_metrics(player_id)

        # Batting rating = blend of average/SR/boundary/power-hitting; skip if player never batted
        batting_rating = round(
            (bat.average_score * 0.4 + bat.strike_rate_score * 0.3 +
             bat.boundary_pct_score * 0.15 + bat.power_hitting_score * 0.15), 1
        ) if bat.sample_size > 0 else 0.0

        bowling_rating = round(
            (bowl.economy_score * 0.45 + bowl.strike_rate_score * 0.30 + bowl.wickets_per_match_score * 0.25), 1
        ) if bowl.sample_size > 0 else 0.0

        fielding_rating = field.efficiency_score

        latest_form = (
            self.db.query(PlayerForm)
            .filter(PlayerForm.player_id == player_id)
            .order_by(PlayerForm.computed_at.desc())
            .first()
        )
        form_rating = latest_form.form_score if latest_form else 0.0

        # Consistency: blend batting/bowling consistency by whichever discipline(s) apply
        if bat.sample_size > 0 and bowl.sample_size > 0:
            consistency_rating = round((consistency.batting_consistency + consistency.bowling_consistency) / 2, 1)
        elif bat.sample_size > 0:
            consistency_rating = consistency.batting_consistency
        elif bowl.sample_size > 0:
            consistency_rating = consistency.bowling_consistency
        else:
            consistency_rating = 0.0

        pressure_rating = self._pressure_score(player_id)

        # For a pure specialist (e.g. a bowler who never bats), re-normalize
        # weights over only the disciplines that actually apply so they
        # aren't penalized for a batting_rating of 0 they never had a chance to earn.
        w = settings
        component_weights = [
            (batting_rating, w.RATING_WEIGHT_BATTING, bat.sample_size > 0),
            (bowling_rating, w.RATING_WEIGHT_BOWLING, bowl.sample_size > 0),
            (fielding_rating, w.RATING_WEIGHT_FIELDING, field.sample_size > 0),
            (form_rating, w.RATING_WEIGHT_FORM, latest_form is not None),
            (consistency_rating, w.RATING_WEIGHT_CONSISTENCY, (bat.sample_size + bowl.sample_size) > 0),
            (pressure_rating, w.RATING_WEIGHT_PRESSURE, True),  # always applies (defaults to neutral 50)
        ]
        applicable = [(score, weight) for score, weight, applies in component_weights if applies]
        total_weight = sum(weight for _, weight in applicable) or 1.0
        overall = round(sum(score * weight for score, weight in applicable) / total_weight, 1)

        breakdown = RatingBreakdown(
            batting_rating=batting_rating, bowling_rating=bowling_rating, fielding_rating=fielding_rating,
            form_rating=form_rating, consistency_rating=consistency_rating, pressure_rating=pressure_rating,
            overall_rating=overall,
        )

        snapshot = PlayerRating(
            player_id=player_id, computed_at=datetime.now(timezone.utc),
            batting_rating=breakdown.batting_rating, bowling_rating=breakdown.bowling_rating,
            fielding_rating=breakdown.fielding_rating, form_rating=breakdown.form_rating,
            consistency_rating=breakdown.consistency_rating, pressure_rating=breakdown.pressure_rating,
            overall_rating=breakdown.overall_rating,
        )
        self.db.add(snapshot)

        # Update the cached fast-read fields on Player itself
        player.current_rating = breakdown.overall_rating
        player.current_form_score = form_rating
        player.batting_consistency = consistency.batting_consistency
        player.bowling_consistency = consistency.bowling_consistency

        self.db.flush()
        return breakdown
