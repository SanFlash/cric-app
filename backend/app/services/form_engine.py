"""
FormEngine implements the recency-weighted form model from spec section 12:
last match 30%, previous 2-3 matches 25%, previous 4-5 matches 20%, long-term
25% (weights configurable via Settings, not hardcoded here).

Per-match performance is scored 0-100 per discipline using PerformanceEngine's
normalization, then those per-match scores are combined into buckets by
recency and weighted-averaged. This is intentionally a *separate* pass from
PerformanceEngine (which only measures) — FormEngine is the first place raw
metrics get combined into a single number, and it does only the recency
weighting; RatingEngine does the cross-discipline weighting.
"""
from __future__ import annotations
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.match import Match
from app.models.performance import BattingPerformance, BowlingPerformance, FieldingPerformance, PlayerForm
from app.services.performance_engine import (
    PerformanceEngine, _scale_up, _scale_down,
    BAT_AVERAGE_CEILING, BAT_STRIKE_RATE_CEILING,
    BOWL_ECONOMY_FLOOR, BOWL_ECONOMY_CEILING,
)


@dataclass
class MatchPerformanceScore:
    match_id: int
    batting_score: float | None  # None if player didn't bat this match
    bowling_score: float | None  # None if player didn't bowl this match
    fielding_bonus: float        # 0-10, added on top of combined score
    combined_score: float        # single 0-100 figure for this match


class FormEngine:
    def __init__(self, db: Session):
        self.db = db
        self.perf = PerformanceEngine(db)

    def _match_score(self, player_id: int, match_id: int) -> MatchPerformanceScore:
        bat_row = (
            self.db.query(BattingPerformance)
            .filter(BattingPerformance.player_id == player_id, BattingPerformance.match_id == match_id)
            .first()
        )
        bowl_row = (
            self.db.query(BowlingPerformance)
            .filter(BowlingPerformance.player_id == player_id, BowlingPerformance.match_id == match_id)
            .first()
        )
        field_rows = (
            self.db.query(FieldingPerformance)
            .filter(FieldingPerformance.player_id == player_id, FieldingPerformance.match_id == match_id)
            .all()
        )

        batting_score = None
        if bat_row:
            avg_equiv = bat_row.runs  # a single innings' "average" is just its runs
            sr = (bat_row.runs / bat_row.balls_faced * 100) if bat_row.balls_faced else 0.0
            batting_score = round(
                _scale_up(avg_equiv, BAT_AVERAGE_CEILING) * 0.6 + _scale_up(sr, BAT_STRIKE_RATE_CEILING) * 0.4, 1
            )

        bowling_score = None
        if bowl_row and bowl_row.balls_bowled > 0:
            economy = bowl_row.runs_conceded / (bowl_row.balls_bowled / 6)
            wkts_component = _scale_up(bowl_row.wickets, 3.0)  # 3-wicket match-haul = ceiling
            economy_component = _scale_down(economy, BOWL_ECONOMY_FLOOR, BOWL_ECONOMY_CEILING)
            bowling_score = round(wkts_component * 0.55 + economy_component * 0.45, 1)

        dismissals = sum(r.catches + r.run_outs + r.stumpings for r in field_rows)
        fielding_bonus = min(10.0, dismissals * 5.0)  # up to +10 for 2+ fielding contributions

        disciplines = [s for s in (batting_score, bowling_score) if s is not None]
        base = (sum(disciplines) / len(disciplines)) if disciplines else 0.0
        combined = round(min(100.0, base + fielding_bonus), 1)

        return MatchPerformanceScore(match_id, batting_score, bowling_score, fielding_bonus, combined)

    def _recent_match_ids(self, player_id: int, before_match_id: int | None = None) -> list[int]:
        """Match IDs the player appeared in (bat/bowl/field), most recent first."""
        bat_ids = {r.match_id for r in
                   self.db.query(BattingPerformance.match_id).filter(BattingPerformance.player_id == player_id)}
        bowl_ids = {r.match_id for r in
                    self.db.query(BowlingPerformance.match_id).filter(BowlingPerformance.player_id == player_id)}
        field_ids = {r.match_id for r in
                     self.db.query(FieldingPerformance.match_id).filter(FieldingPerformance.player_id == player_id)}
        all_ids = bat_ids | bowl_ids | field_ids

        matches = self.db.query(Match).filter(Match.id.in_(all_ids)).all()

        def _naive(dt):
            return dt.replace(tzinfo=None) if dt.tzinfo else dt

        matches.sort(key=lambda m: _naive(m.scheduled_at), reverse=True)
        ordered = [m.id for m in matches]
        if before_match_id is not None and before_match_id in ordered:
            # Only consider matches up to and including the trigger match (form "as of" that match)
            idx = ordered.index(before_match_id)
            ordered = ordered[idx:]
        return ordered

    def compute_and_record(self, player_id: int, match_id: int) -> PlayerForm:
        """
        Recompute this player's recency-weighted form as of `match_id` and
        persist a snapshot. Call this once per player after each match
        completes (StatisticsEngine.finalize_match wires this in).
        """
        recent_ids = self._recent_match_ids(player_id, before_match_id=match_id)
        scores = [self._match_score(player_id, mid) for mid in recent_ids]

        weights = {
            "last": settings.FORM_WEIGHT_LAST_MATCH,
            "recent23": settings.FORM_WEIGHT_LAST_2_3,
            "recent45": settings.FORM_WEIGHT_LAST_4_5,
            "long_term": settings.FORM_WEIGHT_LONG_TERM,
        }

        def bucketed_weighted_avg(values: list[float]) -> float:
            if not values:
                return 0.0
            buckets = {
                "last": values[0:1],
                "recent23": values[1:3],
                "recent45": values[3:5],
                "long_term": values[5:],
            }
            total_weight = 0.0
            weighted_sum = 0.0
            for key, bucket_values in buckets.items():
                if not bucket_values:
                    continue
                bucket_avg = sum(bucket_values) / len(bucket_values)
                weighted_sum += bucket_avg * weights[key]
                total_weight += weights[key]
            return round(weighted_sum / total_weight, 1) if total_weight > 0 else 0.0

        overall_form = bucketed_weighted_avg([s.combined_score for s in scores])
        batting_form = bucketed_weighted_avg([s.batting_score for s in scores if s.batting_score is not None])
        bowling_form = bucketed_weighted_avg([s.bowling_score for s in scores if s.bowling_score is not None])
        match_impact = scores[0].combined_score if scores else 0.0

        match = self.db.get(Match, match_id)
        snapshot = PlayerForm(
            player_id=player_id,
            match_id=match_id,
            computed_at=match.scheduled_at,
            form_score=overall_form,
            batting_form=batting_form,
            bowling_form=bowling_form,
            match_impact_score=match_impact,
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot

    def form_timeline(self, player_id: int, limit: int | None = None) -> list[PlayerForm]:
        """Chronological form history for the form graph (section 4)."""
        q = (
            self.db.query(PlayerForm)
            .filter(PlayerForm.player_id == player_id)
            .order_by(PlayerForm.computed_at.desc())
        )
        if limit:
            q = q.limit(limit)
        return list(reversed(q.all()))
