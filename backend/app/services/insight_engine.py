"""
InsightEngine (section 26). Generates human-readable insight sentences —
but every number in every sentence is read directly from
PerformanceEngine/Player/BattingPerformance etc., never invented. This is
the spec's own requirement: "AI must only use actual stored statistics as
its factual source. Do not fabricate statistics." Enforced structurally
here, not just by instruction: every _insight_* method either returns None
(not enough data / metric doesn't apply) or a string built entirely from
values it just queried in that same method — there's no LLM call and
nothing free-form in the loop.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.org import Player
from app.models.performance import BattingPerformance, BowlingPerformance
from app.services.performance_engine import PerformanceEngine
from app.services.form_engine import FormEngine

MIN_INNINGS_FOR_INSIGHT = 3
RECENT_WINDOW = 5


class InsightEngine:
    def __init__(self, db: Session):
        self.db = db
        self.perf = PerformanceEngine(db)

    def _recent_batting_rows(self, player_id: int, n: int) -> list[BattingPerformance]:
        rows = self.db.query(BattingPerformance).filter(BattingPerformance.player_id == player_id).all()
        rows.sort(key=lambda r: r.id, reverse=True)  # id order approximates chronological insert order
        return rows[:n]

    def _recent_bowling_rows(self, player_id: int, n: int) -> list[BowlingPerformance]:
        rows = self.db.query(BowlingPerformance).filter(BowlingPerformance.player_id == player_id).all()
        rows.sort(key=lambda r: r.id, reverse=True)
        return rows[:n]

    def _insight_boundary_reliance(self, player: Player) -> str | None:
        rows = self._recent_batting_rows(player.id, RECENT_WINDOW)
        if len(rows) < MIN_INNINGS_FOR_INSIGHT:
            return None
        total_runs = sum(r.runs for r in rows)
        boundary_runs = sum(r.fours * 4 + r.sixes * 6 for r in rows)
        if total_runs == 0:
            return None
        pct = round(boundary_runs / total_runs * 100)
        first_name = player.full_name.split(" ")[0]
        return f"{first_name} has scored {pct}% of their runs through boundaries over the last {len(rows)} matches."

    def _insight_bowling_economy_trend(self, player: Player) -> str | None:
        rows = self._recent_bowling_rows(player.id, RECENT_WINDOW)
        if len(rows) < MIN_INNINGS_FOR_INSIGHT:
            return None
        half = len(rows) // 2
        recent_half, older_half = rows[:half], rows[half:]
        if not older_half:
            return None

        def econ(subset):
            balls = sum(r.balls_bowled for r in subset)
            runs = sum(r.runs_conceded for r in subset)
            return (runs / (balls / 6)) if balls > 0 else None

        recent_econ, older_econ = econ(recent_half), econ(older_half)
        if recent_econ is None or older_econ is None or older_econ == 0:
            return None
        change_pct = round((older_econ - recent_econ) / older_econ * 100)
        first_name = player.full_name.split(" ")[0]
        if abs(change_pct) < 5:
            return None  # not a meaningful trend worth surfacing
        direction = "improved" if change_pct > 0 else "worsened"
        return f"{first_name}'s bowling economy has {direction} by {abs(change_pct)}% over the last {len(rows)} matches."

    def _insight_chase_performance(self, player: Player) -> str | None:
        metrics = self.perf.batting_metrics(player.id)
        if metrics.chase_avg_vs_overall_avg is None or metrics.sample_size < MIN_INNINGS_FOR_INSIGHT:
            return None
        first_name = player.full_name.split(" ")[0]
        if metrics.chase_avg_vs_overall_avg >= 1.15:
            pct_better = round((metrics.chase_avg_vs_overall_avg - 1) * 100)
            return f"{first_name} averages {pct_better}% more while chasing than their overall career average."
        if metrics.chase_avg_vs_overall_avg <= 0.85:
            pct_worse = round((1 - metrics.chase_avg_vs_overall_avg) * 100)
            return f"{first_name}'s average drops {pct_worse}% below their career figure while chasing."
        return None  # no meaningful chase-specific pattern

    def _insight_death_overs(self, player: Player) -> str | None:
        metrics = self.perf.batting_metrics(player.id)
        if metrics.sample_size < MIN_INNINGS_FOR_INSIGHT or metrics.death_overs_share == 0:
            return None
        first_name = player.full_name.split(" ")[0]
        pct = round(metrics.death_overs_share * 100)
        if pct >= 25:
            return f"{first_name} has scored {pct}% of their career runs in the death overs — a genuine finisher."
        return None

    def _insight_dot_ball_pressure(self, player: Player) -> str | None:
        metrics = self.perf.bowling_metrics(player.id)
        if metrics.sample_size < MIN_INNINGS_FOR_INSIGHT:
            return None
        first_name = player.full_name.split(" ")[0]
        pct = round(metrics.dot_ball_pct * 100)
        if pct >= 45:
            return f"{first_name} bowls a dot ball {pct}% of the time, consistently building pressure."
        return None

    def player_insights(self, player_id: int) -> list[str]:
        """All applicable insights for a player, skipping any that don't
        have enough data to say something meaningful (None results dropped —
        never padded with a filler sentence)."""
        player: Player = self.db.get(Player, player_id)
        if player is None:
            return []
        candidates = [
            self._insight_boundary_reliance(player),
            self._insight_bowling_economy_trend(player),
            self._insight_chase_performance(player),
            self._insight_death_overs(player),
            self._insight_dot_ball_pressure(player),
        ]
        return [c for c in candidates if c is not None]
