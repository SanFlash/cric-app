"""
ScoringService owns all writes to Innings/Delivery and is the ONLY place
allowed to mutate Innings running totals. Every other engine (Statistics,
Performance, Rating, Prediction) reads from Delivery/*Performance tables —
never from user input directly. This keeps the pipeline in section 32
(Raw Data -> Statistical -> Performance -> Prediction -> AI Insight) honest.

Correction model (section 8 "correct mistakes without corrupting history"):
we never UPDATE a committed Delivery. A correction inserts a new Delivery,
marks the old one `is_corrected=True` + `superseded_by_id`, and the
recompute path walks only non-corrected rows. This keeps a full audit trail
while guaranteeing statistics recomputation is deterministic and idempotent.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.match import Innings, Delivery, Match
from app.models.enums import DeliveryOutcome, DismissalType, MatchStatus
from app.services.statistics_engine import StatisticsEngine

LEGAL_OUTCOMES = {
    DeliveryOutcome.DOT, DeliveryOutcome.ONE, DeliveryOutcome.TWO, DeliveryOutcome.THREE,
    DeliveryOutcome.FOUR, DeliveryOutcome.SIX, DeliveryOutcome.WICKET,
    DeliveryOutcome.BYE, DeliveryOutcome.LEG_BYE,
}
BATTER_RUN_OUTCOMES = {
    DeliveryOutcome.DOT: 0, DeliveryOutcome.ONE: 1, DeliveryOutcome.TWO: 2,
    DeliveryOutcome.THREE: 3, DeliveryOutcome.FOUR: 4, DeliveryOutcome.SIX: 6,
}


@dataclass
class BallInput:
    striker_id: int
    non_striker_id: int
    bowler_id: int
    outcome: DeliveryOutcome
    extra_runs: int = 0  # runs beyond the mandatory 1 for wide/no-ball, or bye/leg-bye count
    is_wicket: bool = False
    dismissal_type: DismissalType | None = None
    dismissed_player_id: int | None = None
    fielder_id: int | None = None


def current_batters_after(last_delivery: Delivery | None) -> tuple[int | None, int | None]:
    """
    Given the most recent delivery in an innings, returns who is actually
    on strike / at the non-striker's end for the NEXT ball — not just the
    raw striker_id/non_striker_id the delivery recorded (which reflect who
    batted THAT ball, before any end-of-ball rotation). Used by both the
    WS reconnect snapshot and the live per-ball broadcast, so there's one
    source of truth for "who's actually at the crease right now" instead
    of each caller reimplementing rotation and risking drift.

    Rotation rules: an odd number of runs off the bat, or completing an
    over, swaps ends. A wicket nulls out whichever end was dismissed
    (the frontend prompts for a replacement) — but batters can still have
    crossed for a run before the dismissal (e.g. a run-out attempting a
    second), so rotation is evaluated first, then the dismissed slot is
    cleared on whichever end it ended up on.
    """
    if last_delivery is None:
        return None, None

    striker, non_striker = last_delivery.striker_id, last_delivery.non_striker_id
    if last_delivery.is_legal_delivery:
        odd_runs = last_delivery.runs_batter % 2 == 1
        over_complete = last_delivery.ball_in_over == 6
        # XOR: an odd run crosses the batters; end-of-over crosses them
        # again for the new over. Both together cancel out — nobody
        # actually ends up swapped — which is exactly the real cricket
        # rule, not a coincidence.
        if odd_runs != over_complete:
            striker, non_striker = non_striker, striker

    if last_delivery.is_wicket and last_delivery.dismissed_player_id is not None:
        if striker == last_delivery.dismissed_player_id:
            striker = None
        elif non_striker == last_delivery.dismissed_player_id:
            non_striker = None

    return striker, non_striker


class ScoringService:
    def __init__(self, db: Session):
        self.db = db
        self.stats_engine = StatisticsEngine(db)

    def record_delivery(self, innings_id: int, ball: BallInput) -> Delivery:
        innings: Innings = self.db.get(Innings, innings_id)
        if innings is None:
            raise ValueError("Innings not found")
        if innings.is_completed:
            raise ValueError("Cannot score a delivery on a completed innings")

        is_legal = ball.outcome in LEGAL_OUTCOMES
        runs_batter, runs_extra = self._split_runs(ball)

        over_number = innings.total_balls // 6
        ball_in_over = (innings.total_balls % 6) + 1 if is_legal else (innings.total_balls % 6)

        # A bowler cannot bowl two overs back to back. Only checked on the
        # first legal ball of a new over (ball_in_over == 1) — mid-over the
        # bowler is obviously fixed already.
        if is_legal and ball_in_over == 1 and over_number > 0:
            prev_over_last_ball = (
                self.db.query(Delivery)
                .filter(Delivery.innings_id == innings.id, Delivery.over_number == over_number - 1,
                        Delivery.is_legal_delivery.is_(True), Delivery.is_corrected.is_(False))
                .order_by(Delivery.sequence_no.desc())
                .first()
            )
            if prev_over_last_ball and prev_over_last_ball.bowler_id == ball.bowler_id:
                raise ValueError("Same bowler cannot bowl consecutive overs")

        delivery = Delivery(
            innings_id=innings.id,
            sequence_no=self._next_sequence_no(innings.id),
            over_number=over_number,
            ball_in_over=ball_in_over,
            striker_id=ball.striker_id,
            non_striker_id=ball.non_striker_id,
            bowler_id=ball.bowler_id,
            outcome=ball.outcome,
            runs_batter=runs_batter,
            runs_extra=runs_extra,
            is_legal_delivery=is_legal,
            is_wicket=ball.is_wicket,
            dismissal_type=ball.dismissal_type,
            dismissed_player_id=ball.dismissed_player_id,
            fielder_id=ball.fielder_id,
        )
        self.db.add(delivery)

        # Update denormalized live totals
        innings.total_runs += runs_batter + runs_extra
        innings.extras += runs_extra if ball.outcome in (
            DeliveryOutcome.WIDE, DeliveryOutcome.NO_BALL, DeliveryOutcome.BYE, DeliveryOutcome.LEG_BYE
        ) else 0
        if is_legal:
            innings.total_balls += 1
        if ball.is_wicket:
            innings.total_wickets += 1

        self.db.flush()

        # Auto-complete innings on all-out, overs-complete, or (2nd innings
        # only) the chasing team reaching their target — a chase that's
        # already been won should end immediately, not keep playing out
        # the rest of the overs/wickets.
        match: Match = self.db.get(Match, innings.match_id)
        max_wickets = self._max_wickets_for(match, innings)
        max_balls = match.overs_limit * 6
        target_reached = innings.target is not None and innings.total_runs >= innings.target
        if innings.total_wickets >= max_wickets or innings.total_balls >= max_balls or target_reached:
            self.complete_innings(innings.id)

        return delivery

    def _max_wickets_for(self, match: Match, innings: Innings) -> int:
        """
        How many wickets end this innings — one fewer than the number of
        players actually available to bat, not a hardcoded 10. Corporate/
        casual cricket teams routinely field fewer than 11 (this app's
        whole reason for existing), and a hardcoded 10 meant a 6-a-side
        team's innings could never legally end via wickets at all — it
        would just keep playing out every remaining over even after every
        available batter was genuinely out, which is wrong, not just
        untidy. Respects squad scoping when the match has one linked for
        the batting team (only the players actually turning up for this
        game), falling back to the full team roster otherwise — same
        precedence the roster-selection endpoint already uses.
        """
        from app.models.org import Player, SquadPlayer

        squad_id = match.squad_a_id if innings.batting_team_id == match.team_a_id else match.squad_b_id
        if squad_id is not None:
            available = (
                self.db.query(SquadPlayer)
                .filter(SquadPlayer.squad_id == squad_id, SquadPlayer.is_available.is_(True))
                .count()
            )
        else:
            available = (
                self.db.query(Player)
                .filter(Player.team_id == innings.batting_team_id, Player.is_deleted.is_(False))
                .count()
            )
        # Never below 1, and never above the real cricket maximum of 10 —
        # a large registered squad (reserves/substitutes beyond the actual
        # XI) shouldn't inflate this past the standard cap; only a squad
        # SMALLER than 11 should ever lower it below 10.
        return max(1, min(10, available - 1))

    def correct_delivery(self, delivery_id: int, corrected: BallInput) -> Delivery:
        """Supersede a previously recorded delivery without deleting history,
        then trigger a full, idempotent stats recompute for the affected match."""
        original: Delivery = self.db.get(Delivery, delivery_id)
        if original is None:
            raise ValueError("Delivery not found")
        if original.is_corrected:
            raise ValueError("Cannot correct an already-superseded delivery")

        innings = self.db.get(Innings, original.innings_id)
        # Roll back the original's contribution to running totals
        self._reverse_delivery_totals(innings, original)
        original.is_corrected = True

        runs_batter, runs_extra = self._split_runs(corrected)
        new_delivery = Delivery(
            innings_id=innings.id,
            sequence_no=original.sequence_no,  # occupies the same slot in the timeline
            over_number=original.over_number,
            ball_in_over=original.ball_in_over,
            striker_id=corrected.striker_id,
            non_striker_id=corrected.non_striker_id,
            bowler_id=corrected.bowler_id,
            outcome=corrected.outcome,
            runs_batter=runs_batter,
            runs_extra=runs_extra,
            is_legal_delivery=corrected.outcome in LEGAL_OUTCOMES,
            is_wicket=corrected.is_wicket,
            dismissal_type=corrected.dismissal_type,
            dismissed_player_id=corrected.dismissed_player_id,
            fielder_id=corrected.fielder_id,
        )
        self.db.add(new_delivery)
        self.db.flush()
        original.superseded_by_id = new_delivery.id

        self._apply_delivery_totals(innings, new_delivery)
        self.db.flush()

        # Section 31: corrections must safely recalculate ALL dependent stats.
        match = self.db.get(Match, innings.match_id)
        self.stats_engine.recompute_match(match.id)

        return new_delivery

    def complete_innings(self, innings_id: int) -> None:
        innings: Innings = self.db.get(Innings, innings_id)
        innings.is_completed = True
        self.db.flush()

        match: Match = self.db.get(Match, innings.match_id)
        # If this was the 1st innings, set the 2nd innings target
        if innings.innings_number == 1:
            second = (
                self.db.query(Innings)
                .filter(Innings.match_id == match.id, Innings.innings_number == 2)
                .first()
            )
            if second:
                second.target = innings.total_runs + 1
        else:
            # Match is over — hand off to StatisticsEngine to finalize the result & all aggregates
            self.stats_engine.finalize_match(match.id)

        self.db.flush()

    # --- internals -------------------------------------------------------

    def _next_sequence_no(self, innings_id: int) -> int:
        last = (
            self.db.query(Delivery)
            .filter(Delivery.innings_id == innings_id)
            .order_by(Delivery.sequence_no.desc())
            .first()
        )
        return (last.sequence_no + 1) if last else 1

    @staticmethod
    def _split_runs(ball: BallInput) -> tuple[int, int]:
        """Returns (runs credited to batter, runs credited as extras)."""
        if ball.outcome in BATTER_RUN_OUTCOMES:
            return BATTER_RUN_OUTCOMES[ball.outcome], 0
        if ball.outcome == DeliveryOutcome.WIDE:
            return 0, 1 + ball.extra_runs
        if ball.outcome == DeliveryOutcome.NO_BALL:
            return ball.extra_runs, 1  # extra_runs here = runs batter scored off the no-ball
        if ball.outcome in (DeliveryOutcome.BYE, DeliveryOutcome.LEG_BYE):
            return 0, ball.extra_runs
        if ball.outcome == DeliveryOutcome.WICKET:
            return 0, 0
        return 0, 0

    def _apply_delivery_totals(self, innings: Innings, d: Delivery) -> None:
        innings.total_runs += d.runs_batter + d.runs_extra
        if d.outcome in (DeliveryOutcome.WIDE, DeliveryOutcome.NO_BALL, DeliveryOutcome.BYE, DeliveryOutcome.LEG_BYE):
            innings.extras += d.runs_extra
        if d.is_legal_delivery:
            innings.total_balls += 1
        if d.is_wicket:
            innings.total_wickets += 1

    def _reverse_delivery_totals(self, innings: Innings, d: Delivery) -> None:
        innings.total_runs -= d.runs_batter + d.runs_extra
        if d.outcome in (DeliveryOutcome.WIDE, DeliveryOutcome.NO_BALL, DeliveryOutcome.BYE, DeliveryOutcome.LEG_BYE):
            innings.extras -= d.runs_extra
        if d.is_legal_delivery:
            innings.total_balls -= 1
        if d.is_wicket:
            innings.total_wickets -= 1
