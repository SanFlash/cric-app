"""
AchievementEngine (section 24). Scans a player's per-match performance rows
right after a match is finalized and awards any milestone badges they
earned — idempotent (checks for an existing Achievement with the same
player_id+match_id+code before inserting) so re-running finalize_match
(e.g. after a correction-triggered recompute) never double-awards.

Thresholds are module constants, not magic numbers scattered through the
checks, so retuning per league/format is a one-line change.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.performance import BattingPerformance, BowlingPerformance, FieldingPerformance, Achievement
from app.models.match import Match

HALF_CENTURY_THRESHOLD = 50
CENTURY_THRESHOLD = 100
THREE_WICKET_THRESHOLD = 3
FIVE_WICKET_THRESHOLD = 5
BEST_ECONOMY_THRESHOLD = 4.0   # runs/over, with a minimum-overs qualifier below
BEST_ECONOMY_MIN_BALLS = 12    # at least 2 overs bowled to qualify
POWER_HITTER_SIXES = 3         # 3+ sixes in a single innings
BEST_FIELDER_DISMISSALS = 2    # 2+ fielding dismissals in a match


@dataclass
class AwardedAchievement:
    code: str
    label: str


class AchievementEngine:
    def __init__(self, db: Session):
        self.db = db

    def _already_awarded(self, player_id: int, match_id: int, code: str) -> bool:
        return (
            self.db.query(Achievement)
            .filter(Achievement.player_id == player_id, Achievement.match_id == match_id, Achievement.code == code)
            .first()
            is not None
        )

    def _award(self, player_id: int, match_id: int, code: str, label: str) -> AwardedAchievement | None:
        if self._already_awarded(player_id, match_id, code):
            return None
        match: Match = self.db.get(Match, match_id)
        self.db.add(Achievement(
            player_id=player_id, match_id=match_id, code=code, label=label,
            awarded_at=match.scheduled_at if match else datetime.now(timezone.utc),
        ))
        self.db.flush()
        return AwardedAchievement(code=code, label=label)

    def check_and_award(self, player_id: int, match_id: int) -> list[AwardedAchievement]:
        awarded: list[AwardedAchievement] = []

        bat = (
            self.db.query(BattingPerformance)
            .filter(BattingPerformance.player_id == player_id, BattingPerformance.match_id == match_id)
            .first()
        )
        if bat:
            if bat.runs >= CENTURY_THRESHOLD:
                a = self._award(player_id, match_id, "CENTURY", f"Scored a century ({bat.runs} runs)")
                if a: awarded.append(a)
            elif bat.runs >= HALF_CENTURY_THRESHOLD:
                a = self._award(player_id, match_id, "HALF_CENTURY", f"Scored a half-century ({bat.runs} runs)")
                if a: awarded.append(a)
            if bat.sixes >= POWER_HITTER_SIXES:
                a = self._award(player_id, match_id, "POWER_HITTER", f"Hit {bat.sixes} sixes in an innings")
                if a: awarded.append(a)

        bowl = (
            self.db.query(BowlingPerformance)
            .filter(BowlingPerformance.player_id == player_id, BowlingPerformance.match_id == match_id)
            .first()
        )
        if bowl:
            if bowl.wickets >= FIVE_WICKET_THRESHOLD:
                a = self._award(player_id, match_id, "FIVE_WICKETS", f"Took {bowl.wickets} wickets in a match")
                if a: awarded.append(a)
            elif bowl.wickets >= THREE_WICKET_THRESHOLD:
                a = self._award(player_id, match_id, "THREE_WICKETS", f"Took {bowl.wickets} wickets in a match")
                if a: awarded.append(a)
            if bowl.balls_bowled >= BEST_ECONOMY_MIN_BALLS:
                economy = bowl.runs_conceded / (bowl.balls_bowled / 6)
                if economy <= BEST_ECONOMY_THRESHOLD:
                    a = self._award(player_id, match_id, "BEST_ECONOMY", f"Economy of {economy:.2f} in the match")
                    if a: awarded.append(a)

        field_rows = (
            self.db.query(FieldingPerformance)
            .filter(FieldingPerformance.player_id == player_id, FieldingPerformance.match_id == match_id)
            .all()
        )
        dismissals = sum(r.catches + r.run_outs + r.stumpings for r in field_rows)
        if dismissals >= BEST_FIELDER_DISMISSALS:
            a = self._award(player_id, match_id, "BEST_FIELDER", f"{dismissals} fielding dismissals in a match")
            if a: awarded.append(a)

        match: Match = self.db.get(Match, match_id)
        if match and match.player_of_match_id == player_id:
            a = self._award(player_id, match_id, "PLAYER_OF_THE_MATCH", "Player of the Match")
            if a: awarded.append(a)

        return awarded

    def player_achievements(self, player_id: int, limit: int | None = None) -> list[Achievement]:
        q = (
            self.db.query(Achievement)
            .filter(Achievement.player_id == player_id)
            .order_by(Achievement.awarded_at.desc())
        )
        if limit:
            q = q.limit(limit)
        return q.all()
