from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Float, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class BattingPerformance(Base, TimestampMixin):
    """One row per player per innings batted. The atomic unit the StatisticsEngine
    aggregates into Player career totals and the PerformanceEngine reads for form."""
    __tablename__ = "batting_performances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    innings_id: Mapped[int] = mapped_column(ForeignKey("innings.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)

    runs: Mapped[int] = mapped_column(Integer, default=0)
    balls_faced: Mapped[int] = mapped_column(Integer, default=0)
    fours: Mapped[int] = mapped_column(Integer, default=0)
    sixes: Mapped[int] = mapped_column(Integer, default=0)
    is_out: Mapped[bool] = mapped_column(Boolean, default=False)
    batting_position: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Situational splits used by the PerformanceEngine (pressure/death-over/powerplay/chase scores)
    powerplay_runs: Mapped[int] = mapped_column(Integer, default=0)
    death_overs_runs: Mapped[int] = mapped_column(Integer, default=0)
    dot_balls: Mapped[int] = mapped_column(Integer, default=0)
    was_chasing: Mapped[bool] = mapped_column(Boolean, default=False)


class BowlingPerformance(Base, TimestampMixin):
    __tablename__ = "bowling_performances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    innings_id: Mapped[int] = mapped_column(ForeignKey("innings.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)

    balls_bowled: Mapped[int] = mapped_column(Integer, default=0)
    runs_conceded: Mapped[int] = mapped_column(Integer, default=0)
    wickets: Mapped[int] = mapped_column(Integer, default=0)
    maidens: Mapped[int] = mapped_column(Integer, default=0)

    powerplay_runs_conceded: Mapped[int] = mapped_column(Integer, default=0)
    death_overs_runs_conceded: Mapped[int] = mapped_column(Integer, default=0)
    dot_balls_bowled: Mapped[int] = mapped_column(Integer, default=0)


class FieldingPerformance(Base, TimestampMixin):
    __tablename__ = "fielding_performances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)

    catches: Mapped[int] = mapped_column(Integer, default=0)
    run_outs: Mapped[int] = mapped_column(Integer, default=0)
    stumpings: Mapped[int] = mapped_column(Integer, default=0)
    dropped_catches: Mapped[int] = mapped_column(Integer, default=0)


class PlayerForm(Base, TimestampMixin):
    """Snapshot of a player's recency-weighted form, recomputed after each match.
    Kept as a time series (not just latest-on-Player) so the form graph in
    section 4 can be rendered without recomputation."""
    __tablename__ = "player_form_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    form_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    batting_form: Mapped[float] = mapped_column(Float, default=0.0)
    bowling_form: Mapped[float] = mapped_column(Float, default=0.0)
    match_impact_score: Mapped[float] = mapped_column(Float, default=0.0)


class PlayerRating(Base, TimestampMixin):
    """Overall rating snapshot — see services/rating_engine.py for the weighted formula."""
    __tablename__ = "player_rating_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    batting_rating: Mapped[float] = mapped_column(Float, default=0.0)
    bowling_rating: Mapped[float] = mapped_column(Float, default=0.0)
    fielding_rating: Mapped[float] = mapped_column(Float, default=0.0)
    form_rating: Mapped[float] = mapped_column(Float, default=0.0)
    consistency_rating: Mapped[float] = mapped_column(Float, default=0.0)
    pressure_rating: Mapped[float] = mapped_column(Float, default=0.0)
    overall_rating: Mapped[float] = mapped_column(Float, default=0.0)


class TeamRating(Base, TimestampMixin):
    __tablename__ = "team_rating_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    batting_strength: Mapped[float] = mapped_column(Float, default=0.0)
    bowling_strength: Mapped[float] = mapped_column(Float, default=0.0)
    allround_strength: Mapped[float] = mapped_column(Float, default=0.0)
    fielding_strength: Mapped[float] = mapped_column(Float, default=0.0)
    recent_form_strength: Mapped[float] = mapped_column(Float, default=0.0)
    bench_strength: Mapped[float] = mapped_column(Float, default=0.0)
    overall_strength: Mapped[float] = mapped_column(Float, default=0.0)


class Prediction(Base, TimestampMixin):
    """Win-probability snapshot. Multiple rows per match: 1 pre-match + N live
    updates (e.g. per over / per wicket) so the momentum graph (section 15) is
    just a time-ordered query, not a recomputation."""
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    team_a_win_pct: Mapped[float] = mapped_column(Float, nullable=False)
    team_b_win_pct: Mapped[float] = mapped_column(Float, nullable=False)
    context: Mapped[str] = mapped_column(String(32), default="pre_match")  # pre_match | over_N | wicket | chase
    # Explainability payload (section 16): list of {"factor": str, "direction": "favor_a"|"favor_b", "weight": float}
    factors: Mapped[dict] = mapped_column(JSON, default=dict)


class Achievement(Base, TimestampMixin):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)  # "HALF_CENTURY", "FIVE_WICKETS", ...
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    related_match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
