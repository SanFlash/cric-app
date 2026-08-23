"""
PerformanceEngine turns raw BattingPerformance/BowlingPerformance/
FieldingPerformance rows into normalized 0-100 sub-metrics. These are the
inputs the RatingEngine and FormEngine combine — this module never combines
anything itself, it only measures.

Normalization approach: each raw stat is mapped onto a 0-100 scale against a
"ceiling" constant representative of a strong corporate/club-level T20
performance (NOT international benchmarks — deliberately lower ceilings so
scores spread meaningfully across a corporate player pool). All ceilings are
named module constants so they're one place to retune per league/format.
"""
from __future__ import annotations
from dataclasses import dataclass, field
import statistics as pystats

from sqlalchemy.orm import Session

from app.models.performance import BattingPerformance, BowlingPerformance, FieldingPerformance

# --- Ceilings (score 100 at/above this raw value; scale linearly below it) ---
BAT_AVERAGE_CEILING = 45.0
BAT_STRIKE_RATE_CEILING = 150.0
BOUNDARY_PCT_CEILING = 0.35          # (4s+6s)/balls_faced
POWER_HITTING_SIX_RATE_CEILING = 0.08  # sixes/balls_faced

BOWL_ECONOMY_FLOOR = 5.0             # economy <= this scores 100 (lower is better)
BOWL_ECONOMY_CEILING = 11.0          # economy >= this scores 0
BOWL_STRIKE_RATE_FLOOR = 12.0        # balls/wicket <= this scores 100 (lower is better)
BOWL_STRIKE_RATE_CEILING = 40.0

FIELDING_DISMISSALS_PER_MATCH_CEILING = 1.2  # (catches+run_outs+stumpings)/matches


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _scale_up(value: float, ceiling: float) -> float:
    """Higher raw value is better. 0 at 0, 100 at/above ceiling."""
    if ceiling <= 0:
        return 0.0
    return _clamp((value / ceiling) * 100)


def _scale_down(value: float, floor: float, ceiling: float) -> float:
    """Lower raw value is better. 100 at/below floor, 0 at/above ceiling."""
    if ceiling <= floor:
        return 0.0
    if value <= floor:
        return 100.0
    if value >= ceiling:
        return 0.0
    return _clamp(100 * (ceiling - value) / (ceiling - floor))


@dataclass
class BattingMetrics:
    average_score: float = 0.0
    strike_rate_score: float = 0.0
    boundary_pct_score: float = 0.0
    power_hitting_score: float = 0.0
    dot_ball_pct: float = 0.0          # raw fraction, not a "score" — lower is better, informational
    powerplay_share: float = 0.0       # fraction of career runs scored in powerplay
    death_overs_share: float = 0.0
    chase_avg_vs_overall_avg: float | None = None  # >1.0 means better while chasing
    sample_size: int = 0               # number of innings this is based on


@dataclass
class BowlingMetrics:
    economy_score: float = 0.0
    strike_rate_score: float = 0.0
    wickets_per_match_score: float = 0.0
    dot_ball_pct: float = 0.0
    powerplay_economy: float | None = None
    death_overs_economy: float | None = None
    sample_size: int = 0


@dataclass
class FieldingMetrics:
    efficiency_score: float = 0.0      # dismissals per match, normalized
    catch_conversion: float | None = None  # catches / (catches + dropped)
    sample_size: int = 0


@dataclass
class ConsistencyMetrics:
    batting_consistency: float = 0.0   # 0-100, higher = more consistent
    bowling_consistency: float = 0.0


class PerformanceEngine:
    def __init__(self, db: Session):
        self.db = db

    def batting_metrics(self, player_id: int, innings: list[BattingPerformance] | None = None) -> BattingMetrics:
        rows = innings if innings is not None else (
            self.db.query(BattingPerformance).filter(BattingPerformance.player_id == player_id).all()
        )
        if not rows:
            return BattingMetrics()

        total_runs = sum(r.runs for r in rows)
        total_balls = sum(r.balls_faced for r in rows)
        total_boundaries_runs = sum(r.fours * 4 + r.sixes * 6 for r in rows)
        total_sixes = sum(r.sixes for r in rows)
        total_dots = sum(r.dot_balls for r in rows)
        dismissals = sum(1 for r in rows if r.is_out)

        avg = total_runs / dismissals if dismissals > 0 else float(total_runs)
        sr = (total_runs / total_balls * 100) if total_balls > 0 else 0.0
        boundary_pct = (total_boundaries_runs / (total_runs or 1)) if total_runs else 0.0
        six_rate = (total_sixes / total_balls) if total_balls > 0 else 0.0
        dot_pct = (total_dots / total_balls) if total_balls > 0 else 0.0

        chasing_rows = [r for r in rows if r.was_chasing]
        chase_avg = None
        if chasing_rows:
            chase_runs = sum(r.runs for r in chasing_rows)
            chase_dismissals = sum(1 for r in chasing_rows if r.is_out)
            chase_avg_val = chase_runs / chase_dismissals if chase_dismissals > 0 else float(chase_runs)
            if avg > 0:
                chase_avg = round(chase_avg_val / avg, 2)

        return BattingMetrics(
            average_score=round(_scale_up(avg, BAT_AVERAGE_CEILING), 1),
            strike_rate_score=round(_scale_up(sr, BAT_STRIKE_RATE_CEILING), 1),
            boundary_pct_score=round(_scale_up(boundary_pct, BOUNDARY_PCT_CEILING), 1),
            power_hitting_score=round(_scale_up(six_rate, POWER_HITTING_SIX_RATE_CEILING), 1),
            dot_ball_pct=round(dot_pct, 3),
            powerplay_share=round(sum(r.powerplay_runs for r in rows) / (total_runs or 1), 3),
            death_overs_share=round(sum(r.death_overs_runs for r in rows) / (total_runs or 1), 3),
            chase_avg_vs_overall_avg=chase_avg,
            sample_size=len(rows),
        )

    def bowling_metrics(self, player_id: int, innings: list[BowlingPerformance] | None = None) -> BowlingMetrics:
        rows = innings if innings is not None else (
            self.db.query(BowlingPerformance).filter(BowlingPerformance.player_id == player_id).all()
        )
        if not rows:
            return BowlingMetrics()

        total_balls = sum(r.balls_bowled for r in rows)
        total_runs = sum(r.runs_conceded for r in rows)
        total_wickets = sum(r.wickets for r in rows)
        total_dots = sum(r.dot_balls_bowled for r in rows)
        matches = len({r.match_id for r in rows})

        economy = (total_runs / (total_balls / 6)) if total_balls > 0 else BOWL_ECONOMY_CEILING
        strike_rate = (total_balls / total_wickets) if total_wickets > 0 else BOWL_STRIKE_RATE_CEILING
        wkts_per_match = (total_wickets / matches) if matches > 0 else 0.0
        dot_pct = (total_dots / total_balls) if total_balls > 0 else 0.0

        pp_balls = sum(1 for _ in rows)  # placeholder guard; real pp/death split computed below
        pp_runs = sum(r.powerplay_runs_conceded for r in rows)
        death_runs = sum(r.death_overs_runs_conceded for r in rows)

        return BowlingMetrics(
            economy_score=round(_scale_down(economy, BOWL_ECONOMY_FLOOR, BOWL_ECONOMY_CEILING), 1),
            strike_rate_score=round(_scale_down(strike_rate, BOWL_STRIKE_RATE_FLOOR, BOWL_STRIKE_RATE_CEILING), 1),
            wickets_per_match_score=round(_scale_up(wkts_per_match, 3.0), 1),  # 3 wkts/match = ceiling
            dot_ball_pct=round(dot_pct, 3),
            powerplay_economy=round(pp_runs / (total_runs or 1), 3) if total_runs else None,
            death_overs_economy=round(death_runs / (total_runs or 1), 3) if total_runs else None,
            sample_size=len(rows),
        )

    def fielding_metrics(self, player_id: int, rows: list[FieldingPerformance] | None = None) -> FieldingMetrics:
        rows = rows if rows is not None else (
            self.db.query(FieldingPerformance).filter(FieldingPerformance.player_id == player_id).all()
        )
        if not rows:
            return FieldingMetrics()

        matches = len({r.match_id for r in rows})
        dismissals = sum(r.catches + r.run_outs + r.stumpings for r in rows)
        dropped = sum(r.dropped_catches for r in rows)
        catches = sum(r.catches for r in rows)

        per_match = dismissals / matches if matches > 0 else 0.0
        conversion = catches / (catches + dropped) if (catches + dropped) > 0 else None

        return FieldingMetrics(
            efficiency_score=round(_scale_up(per_match, FIELDING_DISMISSALS_PER_MATCH_CEILING), 1),
            catch_conversion=round(conversion, 2) if conversion is not None else None,
            sample_size=len(rows),
        )

    def consistency_metrics(self, player_id: int) -> ConsistencyMetrics:
        """
        Consistency = inverse of coefficient of variation (stdev/mean) across
        innings, normalized to 0-100. A player who scores 40,45,38,42 every
        time is more 'consistent' than one who scores 5,90,2,70 for the same
        average — this rewards the former.
        """
        bat_rows = self.db.query(BattingPerformance).filter(BattingPerformance.player_id == player_id).all()
        bowl_rows = self.db.query(BowlingPerformance).filter(BowlingPerformance.player_id == player_id).all()

        bat_score = self._cv_to_score([r.runs for r in bat_rows])
        bowl_score = self._cv_to_score([r.wickets for r in bowl_rows])

        return ConsistencyMetrics(batting_consistency=bat_score, bowling_consistency=bowl_score)

    @staticmethod
    def _cv_to_score(values: list[int | float]) -> float:
        if len(values) < 3:
            return 50.0  # not enough data to judge — return neutral midpoint, not 0
        mean = pystats.mean(values)
        if mean == 0:
            return 0.0
        stdev = pystats.pstdev(values)
        cv = stdev / mean
        # cv of 0 -> 100 (perfectly consistent); cv of 1.5+ -> 0 (wildly inconsistent)
        return round(_clamp(100 * (1 - cv / 1.5)), 1)
