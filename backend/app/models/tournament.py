from __future__ import annotations
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum, Date, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin
from app.models.enums import TournamentFormat


class Venue(Base, TimestampMixin):
    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    pitch_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Aggregate venue-conditioning stats, updated by StatisticsEngine
    avg_first_innings_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    chasing_win_pct: Mapped[float | None] = mapped_column(Float, nullable=True)


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    format: Mapped[TournamentFormat] = mapped_column(SAEnum(TournamentFormat), nullable=False)
    season_label: Mapped[str | None] = mapped_column(String(64), nullable=True)  # "2026", "Winter 2026"
    start_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    standings: Mapped[list[TournamentStanding]] = relationship(back_populates="tournament")


class TournamentStanding(Base, TimestampMixin):
    """Points-table row, recomputed after every match in the tournament."""
    __tablename__ = "tournament_standings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)

    played: Mapped[int] = mapped_column(Integer, default=0)
    won: Mapped[int] = mapped_column(Integer, default=0)
    lost: Mapped[int] = mapped_column(Integer, default=0)
    tied: Mapped[int] = mapped_column(Integer, default=0)
    no_result: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    net_run_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # Raw accumulators NRR is derived from: NRR = (runs_scored/overs_faced) -
    # (runs_conceded/overs_bowled). Stored as running totals (not just the
    # ratio) so each match's contribution can be added incrementally without
    # re-deriving from full match history every time.
    runs_scored: Mapped[int] = mapped_column(Integer, default=0)
    overs_faced: Mapped[float] = mapped_column(Float, default=0.0)
    runs_conceded: Mapped[int] = mapped_column(Integer, default=0)
    overs_bowled: Mapped[float] = mapped_column(Float, default=0.0)

    tournament: Mapped[Tournament] = relationship(back_populates="standings")
    team: Mapped["Team"] = relationship()  # noqa: F821
