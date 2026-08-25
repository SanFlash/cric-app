from __future__ import annotations
from datetime import datetime
from sqlalchemy import (
    String, Integer, ForeignKey, Enum as SAEnum, DateTime, Boolean, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin
from app.models.enums import MatchStatus, TossDecision, DeliveryOutcome, DismissalType


class Match(Base, TimestampMixin):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int | None] = mapped_column(ForeignKey("tournaments.id"), nullable=True)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True)

    team_a_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    team_b_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)

    # Optional: scope the bowler/batter pickers in the Scorer to a specific
    # named squad instead of the team's entire roster. Nullable — a match
    # created without a squad falls back to the full team roster, so this
    # doesn't force squad management on anyone who doesn't want it.
    squad_a_id: Mapped[int | None] = mapped_column(ForeignKey("squads.id"), nullable=True)
    squad_b_id: Mapped[int | None] = mapped_column(ForeignKey("squads.id"), nullable=True)

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    overs_limit: Mapped[int] = mapped_column(Integer, default=20)  # T20 default; 50 = ODI, etc.

    status: Mapped[MatchStatus] = mapped_column(SAEnum(MatchStatus), default=MatchStatus.SCHEDULED)
    toss_winner_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    toss_decision: Mapped[TossDecision | None] = mapped_column(SAEnum(TossDecision), nullable=True)

    umpire_names: Mapped[str | None] = mapped_column(String(255), nullable=True)

    winner_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    result_summary: Mapped[str | None] = mapped_column(String(255), nullable=True)  # "Team A won by 24 runs"
    player_of_match_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True)

    innings: Mapped[list[Innings]] = relationship(back_populates="match", order_by="Innings.innings_number")
    playing_xis: Mapped[list[PlayingXI]] = relationship(back_populates="match")


class PlayingXI(Base, TimestampMixin):
    """One row per (match, team, player) selected in the XI or as substitute."""
    __tablename__ = "playing_xi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)

    batting_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_substitute: Mapped[bool] = mapped_column(Boolean, default=False)
    is_wicketkeeper: Mapped[bool] = mapped_column(Boolean, default=False)
    is_captain: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vice_captain: Mapped[bool] = mapped_column(Boolean, default=False)

    match: Mapped[Match] = relationship(back_populates="playing_xis")

    __table_args__ = (UniqueConstraint("match_id", "player_id", name="uq_match_player_xi"),)


class Innings(Base, TimestampMixin):
    __tablename__ = "innings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    innings_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 or 2 (extendable to 4 for multi-day)
    batting_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    bowling_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)

    # Denormalized running totals — kept in sync by ScoringService on every delivery,
    # never edited directly. Enables O(1) live-scoreboard reads.
    total_runs: Mapped[int] = mapped_column(Integer, default=0)
    total_wickets: Mapped[int] = mapped_column(Integer, default=0)
    total_balls: Mapped[int] = mapped_column(Integer, default=0)  # legal deliveries bowled
    extras: Mapped[int] = mapped_column(Integer, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    target: Mapped[int | None] = mapped_column(Integer, nullable=True)  # set on 2nd innings

    match: Mapped[Match] = relationship(back_populates="innings")
    deliveries: Mapped[list[Delivery]] = relationship(back_populates="innings", order_by="Delivery.sequence_no")

    @property
    def overs_display(self) -> str:
        return f"{self.total_balls // 6}.{self.total_balls % 6}"

    @property
    def run_rate(self) -> float:
        if self.total_balls == 0:
            return 0.0
        return round(self.total_runs / (self.total_balls / 6), 2)


class Delivery(Base, TimestampMixin):
    """
    One row per ball bowled — the immutable source of truth. `sequence_no` is
    monotonic within an innings; a correction is issued as `is_corrected=True`
    superseding the prior row rather than mutating it in place, so historical
    stats can always be recomputed deterministically from this table.
    """
    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    innings_id: Mapped[int] = mapped_column(ForeignKey("innings.id"), nullable=False)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    over_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-indexed
    ball_in_over: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-6 (legal balls only)

    striker_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    non_striker_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    bowler_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)

    outcome: Mapped[DeliveryOutcome] = mapped_column(SAEnum(DeliveryOutcome), nullable=False)
    runs_batter: Mapped[int] = mapped_column(Integer, default=0)  # runs credited to batter
    runs_extra: Mapped[int] = mapped_column(Integer, default=0)  # wide/no-ball/bye/leg-bye runs
    is_legal_delivery: Mapped[bool] = mapped_column(Boolean, default=True)  # False for wide/no-ball

    is_wicket: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissal_type: Mapped[DismissalType | None] = mapped_column(SAEnum(DismissalType), nullable=True)
    dismissed_player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    fielder_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True)  # catch/run-out/stumping

    is_corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    superseded_by_id: Mapped[int | None] = mapped_column(ForeignKey("deliveries.id"), nullable=True)

    innings: Mapped[Innings] = relationship(back_populates="deliveries")
