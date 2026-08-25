"""
StatisticsEngine (section 10 & 31): turns raw Delivery rows into
BattingPerformance / BowlingPerformance / FieldingPerformance rows, then
folds those into Player career aggregates. Every method here is a pure
recompute-from-source — safe to call repeatedly, which is what makes
mid-match corrections (ScoringService.correct_delivery) safe.
"""
from __future__ import annotations
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.match import Match, Innings, Delivery
from app.models.enums import DeliveryOutcome, DismissalType, MatchStatus
from app.models.org import Player
from app.models.performance import BattingPerformance, BowlingPerformance, FieldingPerformance

POWERPLAY_FRACTION = 0.30   # first ~30% of overs (T20: 6 of 20; scales for other formats)
DEATH_OVERS_FRACTION = 0.20  # last ~20% of overs (T20: last 4 of 20)


class StatisticsEngine:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Per-match recompute
    # ------------------------------------------------------------------
    def recompute_match(self, match_id: int) -> None:
        """Rebuild all per-match performance rows for `match_id` from the
        current (non-superseded) Delivery rows, then re-fold career totals
        for every player involved. Idempotent."""
        match: Match = self.db.get(Match, match_id)

        # Wipe and rebuild per-match performance rows for this match
        self.db.query(BattingPerformance).filter(BattingPerformance.match_id == match_id).delete()
        self.db.query(BowlingPerformance).filter(BowlingPerformance.match_id == match_id).delete()
        self.db.query(FieldingPerformance).filter(FieldingPerformance.match_id == match_id).delete()
        self.db.flush()

        involved_players: set[int] = set()

        for innings in match.innings:
            deliveries = [d for d in innings.deliveries if not d.is_corrected]
            powerplay_overs = max(1, round(match.overs_limit * POWERPLAY_FRACTION))
            death_overs_start = max(
                powerplay_overs, match.overs_limit - max(1, round(match.overs_limit * DEATH_OVERS_FRACTION))
            )
            bat_stats: dict[int, dict] = defaultdict(lambda: {
                "runs": 0, "balls_faced": 0, "fours": 0, "sixes": 0, "is_out": False,
                "powerplay_runs": 0, "death_overs_runs": 0, "dot_balls": 0,
            })
            bowl_stats: dict[int, dict] = defaultdict(lambda: {
                "balls_bowled": 0, "runs_conceded": 0, "wickets": 0, "maidens": 0,
                "powerplay_runs_conceded": 0, "death_overs_runs_conceded": 0, "dot_balls_bowled": 0,
            })
            field_stats: dict[int, dict] = defaultdict(lambda: {
                "catches": 0, "run_outs": 0, "stumpings": 0,
            })

            for d in deliveries:
                involved_players.update(filter(None, [d.striker_id, d.bowler_id, d.fielder_id]))
                is_powerplay = d.over_number < powerplay_overs
                is_death = d.over_number >= death_overs_start

                # Batting side
                if d.outcome not in (DeliveryOutcome.BYE, DeliveryOutcome.LEG_BYE):
                    b = bat_stats[d.striker_id]
                    b["runs"] += d.runs_batter
                    if d.outcome == DeliveryOutcome.FOUR:
                        b["fours"] += 1
                    if d.outcome == DeliveryOutcome.SIX:
                        b["sixes"] += 1
                    if d.is_legal_delivery or d.outcome == DeliveryOutcome.NO_BALL:
                        b["balls_faced"] += 1
                        if d.runs_batter == 0:
                            b["dot_balls"] += 1
                    if is_powerplay:
                        b["powerplay_runs"] += d.runs_batter
                    if is_death:
                        b["death_overs_runs"] += d.runs_batter

                if d.is_wicket and d.dismissed_player_id:
                    bat_stats[d.dismissed_player_id]["is_out"] = True

                # Bowling side
                bw = bowl_stats[d.bowler_id]
                if d.is_legal_delivery:
                    bw["balls_bowled"] += 1
                    if d.runs_batter == 0 and d.runs_extra == 0:
                        bw["dot_balls_bowled"] += 1
                conceded = d.runs_batter + (d.runs_extra if d.outcome in (
                    DeliveryOutcome.WIDE, DeliveryOutcome.NO_BALL
                ) else 0)
                bw["runs_conceded"] += conceded
                if is_powerplay:
                    bw["powerplay_runs_conceded"] += conceded
                if is_death:
                    bw["death_overs_runs_conceded"] += conceded
                if d.is_wicket and d.dismissal_type not in (DismissalType.RUN_OUT,):
                    bw["wickets"] += 1

                # Fielding
                if d.is_wicket and d.fielder_id:
                    fs = field_stats[d.fielder_id]
                    if d.dismissal_type == DismissalType.CAUGHT:
                        fs["catches"] += 1
                    elif d.dismissal_type == DismissalType.RUN_OUT:
                        fs["run_outs"] += 1
                    elif d.dismissal_type == DismissalType.STUMPED:
                        fs["stumpings"] += 1

            for player_id, s in bat_stats.items():
                self.db.add(BattingPerformance(match_id=match_id, innings_id=innings.id, player_id=player_id, **s))
            for player_id, s in bowl_stats.items():
                self.db.add(BowlingPerformance(match_id=match_id, innings_id=innings.id, player_id=player_id, **s))
            for player_id, s in field_stats.items():
                self.db.add(FieldingPerformance(match_id=match_id, player_id=player_id, **s))

        self.db.flush()

        for player_id in involved_players:
            self.recompute_player_career(player_id)

    def finalize_match(self, match_id: int) -> None:
        """Called once both innings are complete: set the result, recompute
        stats, then cascade into form/rating recomputation for every involved
        player (section 10: fully automatic, no manual stat entry)."""
        match: Match = self.db.get(Match, match_id)
        self.recompute_match(match_id)

        innings = sorted(match.innings, key=lambda i: i.innings_number)
        if len(innings) == 2:
            first, second = innings
            if second.total_runs > first.total_runs:
                match.winner_team_id = second.batting_team_id
                margin = 10 - second.total_wickets
                match.result_summary = f"Won by {margin} wicket(s)"
            elif second.total_runs < first.total_runs:
                match.winner_team_id = first.batting_team_id
                margin = first.total_runs - second.total_runs
                match.result_summary = f"Won by {margin} run(s)"
            else:
                match.result_summary = "Match tied"
        match.status = MatchStatus.COMPLETED
        self.db.flush()

        from app.services.tournament_service import TournamentService
        TournamentService(self.db).update_after_match(match_id)

        self._recompute_form_and_ratings(match_id)

    def _recompute_form_and_ratings(self, match_id: int) -> None:
        """Local import to avoid a circular import (form/rating engines import
        from this module's sibling, not from StatisticsEngine itself)."""
        from app.services.form_engine import FormEngine
        from app.services.rating_engine import RatingEngine
        from app.services.achievement_engine import AchievementEngine
        from app.services.notification_service import NotificationService

        match: Match = self.db.get(Match, match_id)
        involved: set[int] = set()
        for innings in match.innings:
            for d in innings.deliveries:
                if d.is_corrected:
                    continue
                involved.update(filter(None, [d.striker_id, d.bowler_id, d.fielder_id]))

        form_engine = FormEngine(self.db)
        rating_engine = RatingEngine(self.db)
        for player_id in involved:
            form_engine.compute_and_record(player_id, match_id)
        for player_id in involved:
            # Rating runs after ALL players' form is recorded, since rating
            # reads each player's own latest form snapshot only (no cross-player dependency,
            # but keeping the loops separate makes that invariant explicit).
            rating_engine.compute_and_record(player_id)
        self.db.flush()

        # Section 24: automatic achievement detection, then section 23:
        # notify each achiever and every player on both teams of the result.
        achievement_engine = AchievementEngine(self.db)
        notifier = NotificationService(self.db)
        for player_id in involved:
            for achievement in achievement_engine.check_and_award(player_id, match_id):
                notifier.notify_achievement(player_id, match_id, achievement)
        notifier.notify_match_result(match_id)
        self.db.flush()

    # ------------------------------------------------------------------
    # Career aggregate recompute (safe to re-run any time)
    # ------------------------------------------------------------------
    def recompute_player_career(self, player_id: int) -> None:
        player: Player = self.db.get(Player, player_id)
        if player is None:
            return

        bat_rows = self.db.query(BattingPerformance).filter(BattingPerformance.player_id == player_id).all()
        bowl_rows = self.db.query(BowlingPerformance).filter(BowlingPerformance.player_id == player_id).all()
        field_rows = self.db.query(FieldingPerformance).filter(FieldingPerformance.player_id == player_id).all()

        player.bat_innings = len(bat_rows)
        player.bat_matches = len({r.match_id for r in bat_rows})
        player.bat_runs = sum(r.runs for r in bat_rows)
        player.bat_balls_faced = sum(r.balls_faced for r in bat_rows)
        player.bat_not_outs = sum(1 for r in bat_rows if not r.is_out)
        player.bat_highest_score = max((r.runs for r in bat_rows), default=0)
        player.bat_fifties = sum(1 for r in bat_rows if 50 <= r.runs < 100)
        player.bat_hundreds = sum(1 for r in bat_rows if r.runs >= 100)
        player.bat_fours = sum(r.fours for r in bat_rows)
        player.bat_sixes = sum(r.sixes for r in bat_rows)

        player.bowl_matches = len({r.match_id for r in bowl_rows})
        player.bowl_balls = sum(r.balls_bowled for r in bowl_rows)
        player.bowl_runs_conceded = sum(r.runs_conceded for r in bowl_rows)
        player.bowl_wickets = sum(r.wickets for r in bowl_rows)
        player.bowl_maidens = sum(r.maidens for r in bowl_rows)
        player.bowl_three_fers = sum(1 for r in bowl_rows if r.wickets == 3)
        player.bowl_five_fers = sum(1 for r in bowl_rows if r.wickets >= 5)
        best = max(bowl_rows, key=lambda r: (r.wickets, -r.runs_conceded), default=None)
        player.bowl_best_figures = f"{best.wickets}/{best.runs_conceded}" if best else None

        player.field_catches = sum(r.catches for r in field_rows)
        player.field_run_outs = sum(r.run_outs for r in field_rows)
        player.field_stumpings = sum(r.stumpings for r in field_rows)

        self.db.flush()
