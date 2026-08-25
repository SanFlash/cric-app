"""
TournamentService owns TournamentStanding rows. Called automatically from
StatisticsEngine.finalize_match whenever a completed match belongs to a
tournament (section 19: "Automatically generate tournament standings").

NRR (Net Run Rate) follows the standard cricket formula:
    NRR = (total runs scored / total overs faced) - (total runs conceded / total overs bowled)
computed cumulatively across every match the team has played in the
tournament — not just the latest match — which is why TournamentStanding
stores running totals rather than only the ratio.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.match import Match, Innings
from app.models.tournament import TournamentStanding
from app.models.enums import MatchStatus


class TournamentService:
    def __init__(self, db: Session):
        self.db = db

    def _get_or_create_standing(self, tournament_id: int, team_id: int) -> TournamentStanding:
        row = (
            self.db.query(TournamentStanding)
            .filter(TournamentStanding.tournament_id == tournament_id, TournamentStanding.team_id == team_id)
            .first()
        )
        if row is None:
            row = TournamentStanding(tournament_id=tournament_id, team_id=team_id)
            self.db.add(row)
            self.db.flush()
        return row

    def update_after_match(self, match_id: int) -> None:
        match: Match = self.db.get(Match, match_id)
        if match.tournament_id is None:
            return  # not a tournament fixture — nothing to update

        standing_a = self._get_or_create_standing(match.tournament_id, match.team_a_id)
        standing_b = self._get_or_create_standing(match.tournament_id, match.team_b_id)

        if match.status == MatchStatus.ABANDONED:
            for standing in (standing_a, standing_b):
                standing.played += 1
                standing.no_result += 1
                standing.points += settings.POINTS_NO_RESULT
            self.db.flush()
            return

        if match.status != MatchStatus.COMPLETED:
            return  # scheduled/live — standings only update on a final result

        innings = {i.batting_team_id: i for i in match.innings}
        team_a_innings = innings.get(match.team_a_id)
        team_b_innings = innings.get(match.team_b_id)

        def apply_runrate(standing: TournamentStanding, batted: Innings | None, bowled_against: Innings | None):
            if batted:
                standing.runs_scored += batted.total_runs
                # A team all-out counts its full allotted overs faced (standard NRR convention),
                # not just balls actually bowled, so a collapse doesn't inflate their NRR.
                balls = match.overs_limit * 6 if batted.total_wickets >= 10 else batted.total_balls
                standing.overs_faced += balls / 6
            if bowled_against:
                standing.runs_conceded += bowled_against.total_runs
                balls = match.overs_limit * 6 if bowled_against.total_wickets >= 10 else bowled_against.total_balls
                standing.overs_bowled += balls / 6

        apply_runrate(standing_a, team_a_innings, team_b_innings)
        apply_runrate(standing_b, team_b_innings, team_a_innings)

        for standing in (standing_a, standing_b):
            standing.played += 1

        if match.winner_team_id == match.team_a_id:
            standing_a.won += 1
            standing_a.points += settings.POINTS_WIN
            standing_b.lost += 1
            standing_b.points += settings.POINTS_LOSS
        elif match.winner_team_id == match.team_b_id:
            standing_b.won += 1
            standing_b.points += settings.POINTS_WIN
            standing_a.lost += 1
            standing_a.points += settings.POINTS_LOSS
        else:
            standing_a.tied += 1
            standing_b.tied += 1
            standing_a.points += settings.POINTS_TIE
            standing_b.points += settings.POINTS_TIE

        for standing in (standing_a, standing_b):
            for_rr = (standing.runs_scored / standing.overs_faced) if standing.overs_faced > 0 else 0.0
            against_rr = (standing.runs_conceded / standing.overs_bowled) if standing.overs_bowled > 0 else 0.0
            standing.net_run_rate = round(for_rr - against_rr, 3)

        self.db.flush()

    def get_points_table(self, tournament_id: int) -> list[TournamentStanding]:
        """Sorted by points desc, then NRR desc — the standard cricket tie-break."""
        return (
            self.db.query(TournamentStanding)
            .filter(TournamentStanding.tournament_id == tournament_id)
            .order_by(TournamentStanding.points.desc(), TournamentStanding.net_run_rate.desc())
            .all()
        )
