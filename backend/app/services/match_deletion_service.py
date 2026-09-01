"""
Deleting a match isn't a plain row delete — its data has already been
folded into player career totals, ratings, and (if it was a tournament
fixture) the points table. This service unwinds all of that correctly:

1. Delete the match's Deliveries, per-match Performance rows,
   Predictions, and any Achievements awarded specifically for this match
   (e.g. "Hit 3 sixes in an innings" from a match that no longer
   happened shouldn't keep showing on the player's profile).
2. For every player who batted or bowled in it, recompute their career
   totals and overall rating fresh from their REMAINING performance rows
   — not by subtracting numbers (error-prone), but by re-aggregating from
   scratch, the same way StatisticsEngine/RatingEngine already do.
3. If the match belonged to a tournament, rebuild that tournament's whole
   standings table from scratch by replaying every OTHER completed match
   in chronological order — again, not incremental subtraction. Team
   standings only ever accumulate (see TournamentService.update_after_match),
   so subtracting one match's contribution safely requires starting over
   and replaying the rest, not trying to reverse the arithmetic.
4. Delete the Innings rows, then the Match itself.
"""
from sqlalchemy.orm import Session

from app.models.match import Match, Innings, Delivery
from app.models.performance import BattingPerformance, BowlingPerformance, FieldingPerformance, Prediction, Achievement, PlayerForm
from app.models.tournament import TournamentStanding
from app.models.enums import MatchStatus
from app.services.statistics_engine import StatisticsEngine
from app.services.rating_engine import RatingEngine
from app.services.form_engine import FormEngine


class MatchDeletionService:
    def __init__(self, db: Session):
        self.db = db

    def delete_match(self, match_id: int) -> dict:
        match = self.db.get(Match, match_id)
        if not match:
            raise ValueError("Match not found")

        innings_ids = [i.id for i in self.db.query(Innings).filter(Innings.match_id == match_id).all()]

        affected_players: set[int] = set()
        for row in self.db.query(BattingPerformance).filter(BattingPerformance.match_id == match_id).all():
            affected_players.add(row.player_id)
        for row in self.db.query(BowlingPerformance).filter(BowlingPerformance.match_id == match_id).all():
            affected_players.add(row.player_id)
        for row in self.db.query(FieldingPerformance).filter(FieldingPerformance.match_id == match_id).all():
            affected_players.add(row.player_id)

        # 1. Delete deliveries, performances, predictions for this match.
        if innings_ids:
            self.db.query(Delivery).filter(Delivery.innings_id.in_(innings_ids)).delete(synchronize_session=False)
        self.db.query(BattingPerformance).filter(BattingPerformance.match_id == match_id).delete(synchronize_session=False)
        self.db.query(BowlingPerformance).filter(BowlingPerformance.match_id == match_id).delete(synchronize_session=False)
        self.db.query(FieldingPerformance).filter(FieldingPerformance.match_id == match_id).delete(synchronize_session=False)
        self.db.query(Prediction).filter(Prediction.match_id == match_id).delete(synchronize_session=False)
        self.db.query(Achievement).filter(Achievement.match_id == match_id).delete(synchronize_session=False)
        self.db.flush()

        # 2. Recompute every affected player's career totals + rating fresh
        # from whatever performance rows remain — no subtraction, full
        # re-aggregation, so this is correct regardless of how many other
        # matches they've played.
        #
        # Form needs the same treatment, and for a subtler reason: a
        # player's PlayerForm snapshot is tied to a specific match ("form
        # AS OF this match") and RatingEngine reads whichever snapshot is
        # newest. If their only (or most recent) match gets deleted, that
        # stale snapshot is still "newest" and still gets read — silently
        # reintroducing the deleted match's contribution into their
        # overall rating through the back door, even though career
        # stats/batting/bowling all correctly show zero. Caught this via
        # a real player's rating going UP after their only match was
        # deleted (100 stale form score with nothing to counterweight it
        # once batting/bowling dropped out of the weighted average
        # entirely). Fixed by clearing every form snapshot for affected
        # players and rebuilding one fresh snapshot from whatever match
        # they most recently actually played, if any remain.
        stats_engine = StatisticsEngine(self.db)
        rating_engine = RatingEngine(self.db)
        form_engine = FormEngine(self.db)
        for player_id in affected_players:
            stats_engine.recompute_player_career(player_id)

            self.db.query(PlayerForm).filter(PlayerForm.player_id == player_id).delete(synchronize_session=False)
            self.db.flush()
            remaining_match_ids = {
                r.match_id for r in self.db.query(BattingPerformance).filter(BattingPerformance.player_id == player_id).all()
            } | {
                r.match_id for r in self.db.query(BowlingPerformance).filter(BowlingPerformance.player_id == player_id).all()
            }
            if remaining_match_ids:
                most_recent_match_id = max(remaining_match_ids)  # matches are created in roughly chronological id order
                form_engine.compute_and_record(player_id, most_recent_match_id)

            rating_engine.compute_and_record(player_id)
        self.db.flush()

        # 3. Tournament standings: rebuild the whole table from scratch by
        # replaying every OTHER completed match in the tournament, in
        # chronological order.
        tournament_id = match.tournament_id
        if tournament_id is not None:
            self._rebuild_tournament_standings(tournament_id, exclude_match_id=match_id)

        # 4. Delete innings, then the match itself.
        self.db.query(Innings).filter(Innings.match_id == match_id).delete(synchronize_session=False)
        self.db.delete(match)
        self.db.commit()

        return {"affected_players": len(affected_players), "tournament_rebuilt": tournament_id is not None}

    def _rebuild_tournament_standings(self, tournament_id: int, exclude_match_id: int) -> None:
        from app.services.tournament_service import TournamentService

        self.db.query(TournamentStanding).filter(TournamentStanding.tournament_id == tournament_id).delete(synchronize_session=False)
        self.db.flush()

        remaining = (
            self.db.query(Match)
            .filter(
                Match.tournament_id == tournament_id,
                Match.id != exclude_match_id,
                Match.status.in_([MatchStatus.COMPLETED, MatchStatus.ABANDONED]),
            )
            .order_by(Match.scheduled_at.asc())
            .all()
        )
        tournament_service = TournamentService(self.db)
        for m in remaining:
            tournament_service.update_after_match(m.id)
        self.db.flush()
