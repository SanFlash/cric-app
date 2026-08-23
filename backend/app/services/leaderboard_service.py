"""
LeaderboardService (section 20). Leaderboards are computed from the
per-match Batting/Bowling/FieldingPerformance tables (not the cached career
totals on Player) precisely so they can be filtered by tournament/team —
a career total on Player has no tournament scope, but a performance row
joined to Match->tournament_id does.

Metrics with a natural "minimum sample" requirement (average, strike rate,
economy) apply a configurable floor so a single-innings outlier can't top
the board — mirrors how real cricket boards handle "qualified" averages.
"""
from __future__ import annotations
from dataclasses import dataclass
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.match import Match
from app.models.org import Player
from app.models.performance import BattingPerformance, BowlingPerformance, FieldingPerformance

MIN_INNINGS_FOR_AVERAGE = 3
MIN_BALLS_FOR_STRIKE_RATE = 30
MIN_BALLS_FOR_ECONOMY = 24  # 4 overs


@dataclass
class LeaderboardEntry:
    player_id: int
    full_name: str
    value: float
    secondary: str | None = None  # extra context, e.g. "off 42 balls"


class LeaderboardService:
    def __init__(self, db: Session):
        self.db = db

    def _match_filter(self, query, tournament_id: int | None, team_id: int | None, performance_model):
        if tournament_id is not None:
            query = query.join(Match, performance_model.match_id == Match.id).filter(Match.tournament_id == tournament_id)
        if team_id is not None:
            players_on_team = self.db.query(Player.id).filter(Player.team_id == team_id)
            query = query.filter(performance_model.player_id.in_(players_on_team))
        return query

    # ------------------------------------------------------------------ batting
    def most_runs(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        q = self.db.query(
            BattingPerformance.player_id, func.sum(BattingPerformance.runs).label("total")
        ).group_by(BattingPerformance.player_id)
        q = self._match_filter(q, tournament_id, team_id, BattingPerformance)
        rows = q.order_by(func.sum(BattingPerformance.runs).desc()).limit(limit).all()
        return self._to_entries(rows)

    def highest_score(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        q = self.db.query(
            BattingPerformance.player_id, func.max(BattingPerformance.runs).label("total")
        ).group_by(BattingPerformance.player_id)
        q = self._match_filter(q, tournament_id, team_id, BattingPerformance)
        rows = q.order_by(func.max(BattingPerformance.runs).desc()).limit(limit).all()
        return self._to_entries(rows)

    def best_average(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        q = self.db.query(
            BattingPerformance.player_id,
            func.sum(BattingPerformance.runs).label("runs"),
            func.count(BattingPerformance.id).label("innings"),
            func.sum(case((BattingPerformance.is_out.is_(True), 1), else_=0)).label("outs"),
        ).group_by(BattingPerformance.player_id)
        q = self._match_filter(q, tournament_id, team_id, BattingPerformance)
        rows = q.having(func.count(BattingPerformance.id) >= MIN_INNINGS_FOR_AVERAGE).all()
        entries = []
        for player_id, runs, innings, outs in rows:
            dismissals = outs or 0
            avg = runs / dismissals if dismissals > 0 else float(runs)
            entries.append((player_id, avg, f"{innings} innings"))
        entries.sort(key=lambda e: -e[1])
        return self._entries_with_names(entries[:limit])

    def best_strike_rate(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        q = self.db.query(
            BattingPerformance.player_id,
            func.sum(BattingPerformance.runs).label("runs"),
            func.sum(BattingPerformance.balls_faced).label("balls"),
        ).group_by(BattingPerformance.player_id)
        q = self._match_filter(q, tournament_id, team_id, BattingPerformance)
        rows = q.having(func.sum(BattingPerformance.balls_faced) >= MIN_BALLS_FOR_STRIKE_RATE).all()
        entries = [(pid, (runs / balls * 100) if balls else 0.0, f"{balls} balls faced")
                   for pid, runs, balls in rows]
        entries.sort(key=lambda e: -e[1])
        return self._entries_with_names(entries[:limit])

    def most_sixes(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        return self._sum_metric(BattingPerformance, BattingPerformance.sixes, tournament_id, team_id, limit)

    def most_fours(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        return self._sum_metric(BattingPerformance, BattingPerformance.fours, tournament_id, team_id, limit)

    # ------------------------------------------------------------------ bowling
    def most_wickets(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        return self._sum_metric(BowlingPerformance, BowlingPerformance.wickets, tournament_id, team_id, limit)

    def best_economy(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        q = self.db.query(
            BowlingPerformance.player_id,
            func.sum(BowlingPerformance.runs_conceded).label("runs"),
            func.sum(BowlingPerformance.balls_bowled).label("balls"),
        ).group_by(BowlingPerformance.player_id)
        q = self._match_filter(q, tournament_id, team_id, BowlingPerformance)
        rows = q.having(func.sum(BowlingPerformance.balls_bowled) >= MIN_BALLS_FOR_ECONOMY).all()
        entries = [(pid, (runs / (balls / 6)) if balls else 999.0, f"{balls // 6}.{balls % 6} overs")
                   for pid, runs, balls in rows]
        entries.sort(key=lambda e: e[1])  # ascending — lower economy is better
        return self._entries_with_names(entries[:limit])

    def best_bowling_figures(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        """Best single-match figures per player (most wickets, fewest runs as tiebreak)."""
        q = self.db.query(
            BowlingPerformance.player_id, BowlingPerformance.wickets, BowlingPerformance.runs_conceded
        )
        q = self._match_filter(q, tournament_id, team_id, BowlingPerformance)
        rows = q.all()
        best_per_player: dict[int, tuple[int, int]] = {}
        for pid, wkts, runs in rows:
            current = best_per_player.get(pid)
            if current is None or (wkts, -runs) > (current[0], -current[1]):
                best_per_player[pid] = (wkts, runs)
        entries = [(pid, wkts, f"{wkts}/{runs}") for pid, (wkts, runs) in best_per_player.items()]
        entries.sort(key=lambda e: -e[1])
        return self._entries_with_names(entries[:limit])

    # ------------------------------------------------------------------ fielding
    def most_catches(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        return self._sum_metric(FieldingPerformance, FieldingPerformance.catches, tournament_id, team_id, limit)

    def most_run_outs(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        return self._sum_metric(FieldingPerformance, FieldingPerformance.run_outs, tournament_id, team_id, limit)

    def most_stumpings(self, tournament_id=None, team_id=None, limit=10) -> list[LeaderboardEntry]:
        return self._sum_metric(FieldingPerformance, FieldingPerformance.stumpings, tournament_id, team_id, limit)

    # ------------------------------------------------------------------ overall (career-cached, not tournament-scoped)
    def best_current_form(self, limit=10) -> list[LeaderboardEntry]:
        players = self.db.query(Player).filter(Player.is_deleted.is_(False)).order_by(Player.current_form_score.desc()).limit(limit).all()
        return [LeaderboardEntry(p.id, p.full_name, p.current_form_score) for p in players]

    def best_overall_rating(self, limit=10) -> list[LeaderboardEntry]:
        players = self.db.query(Player).filter(Player.is_deleted.is_(False)).order_by(Player.current_rating.desc()).limit(limit).all()
        return [LeaderboardEntry(p.id, p.full_name, p.current_rating) for p in players]

    # ------------------------------------------------------------------ internals
    def _sum_metric(self, model, column, tournament_id, team_id, limit) -> list[LeaderboardEntry]:
        q = self.db.query(model.player_id, func.sum(column).label("total")).group_by(model.player_id)
        q = self._match_filter(q, tournament_id, team_id, model)
        rows = q.order_by(func.sum(column).desc()).limit(limit).all()
        return self._to_entries(rows)

    def _to_entries(self, rows) -> list[LeaderboardEntry]:
        return self._entries_with_names([(pid, val, None) for pid, val in rows])

    def _entries_with_names(self, entries: list[tuple[int, float, str | None]]) -> list[LeaderboardEntry]:
        if not entries:
            return []
        player_ids = [e[0] for e in entries]
        players = {p.id: p for p in self.db.query(Player).filter(Player.id.in_(player_ids)).all()}
        return [
            LeaderboardEntry(pid, players[pid].full_name if pid in players else "Unknown", round(val, 2), secondary)
            for pid, val, secondary in entries if pid in players
        ]
