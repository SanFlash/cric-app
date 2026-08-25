from __future__ import annotations
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum, Date, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, SoftDeleteMixin
from app.models.enums import UserRole, PlayingRole, BattingStyle, BowlingStyle, PlayerStatus


class User(Base, TimestampMixin, SoftDeleteMixin):
    """Auth identity. One User optionally links 1:1 to a Player profile."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.VIEWER)
    is_active: Mapped[bool] = mapped_column(default=True)

    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    company: Mapped[Company | None] = relationship(back_populates="users")

    # Set when a captain accepts a team invite (see TeamInvite) — the team
    # they're authorized to manage. Independent of player_profile: a captain
    # doesn't have to also be a registered Player on the team.
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)

    player_profile: Mapped[Player | None] = relationship(back_populates="user", uselist=False)


class Company(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    users: Mapped[list[User]] = relationship(back_populates="company")
    teams: Mapped[list[Team]] = relationship(back_populates="company")


class Team(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    captain_id: Mapped[int | None] = mapped_column(ForeignKey("players.id", use_alter=True), nullable=True)
    vice_captain_id: Mapped[int | None] = mapped_column(ForeignKey("players.id", use_alter=True), nullable=True)
    coach_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    company: Mapped[Company] = relationship(back_populates="teams")
    players: Mapped[list[Player]] = relationship(
        back_populates="team", foreign_keys="Player.team_id"
    )
    squads: Mapped[list[Squad]] = relationship(back_populates="team")

    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_team_name_per_company"),)


class Player(Base, TimestampMixin, SoftDeleteMixin):
    """
    Cricket profile. Career aggregate stats are DERIVED columns maintained by
    the StatisticsEngine after each match — never edited directly by users.
    See services/statistics_engine.py.
    """
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)

    # Basic info
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    department: Mapped[str | None] = mapped_column(String(128), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    date_of_joining: Mapped[Date | None] = mapped_column(Date, nullable=True)
    jersey_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[PlayerStatus] = mapped_column(SAEnum(PlayerStatus), default=PlayerStatus.ACTIVE)

    # Cricket info
    playing_role: Mapped[PlayingRole] = mapped_column(SAEnum(PlayingRole), nullable=False)
    batting_style: Mapped[BattingStyle | None] = mapped_column(SAEnum(BattingStyle), nullable=True)
    bowling_style: Mapped[BowlingStyle | None] = mapped_column(SAEnum(BowlingStyle), nullable=True)
    preferred_batting_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_level: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # --- Derived career batting stats (updated by StatisticsEngine) ---
    bat_matches: Mapped[int] = mapped_column(Integer, default=0)
    bat_innings: Mapped[int] = mapped_column(Integer, default=0)
    bat_runs: Mapped[int] = mapped_column(Integer, default=0)
    bat_balls_faced: Mapped[int] = mapped_column(Integer, default=0)
    bat_not_outs: Mapped[int] = mapped_column(Integer, default=0)
    bat_highest_score: Mapped[int] = mapped_column(Integer, default=0)
    bat_fifties: Mapped[int] = mapped_column(Integer, default=0)
    bat_hundreds: Mapped[int] = mapped_column(Integer, default=0)
    bat_fours: Mapped[int] = mapped_column(Integer, default=0)
    bat_sixes: Mapped[int] = mapped_column(Integer, default=0)

    # --- Derived career bowling stats ---
    bowl_matches: Mapped[int] = mapped_column(Integer, default=0)
    bowl_balls: Mapped[int] = mapped_column(Integer, default=0)
    bowl_runs_conceded: Mapped[int] = mapped_column(Integer, default=0)
    bowl_wickets: Mapped[int] = mapped_column(Integer, default=0)
    bowl_maidens: Mapped[int] = mapped_column(Integer, default=0)
    bowl_best_figures: Mapped[str | None] = mapped_column(String(16), nullable=True)  # e.g. "5/21"
    bowl_three_fers: Mapped[int] = mapped_column(Integer, default=0)
    bowl_five_fers: Mapped[int] = mapped_column(Integer, default=0)

    # --- Derived career fielding stats ---
    field_catches: Mapped[int] = mapped_column(Integer, default=0)
    field_run_outs: Mapped[int] = mapped_column(Integer, default=0)
    field_stumpings: Mapped[int] = mapped_column(Integer, default=0)
    field_dropped_catches: Mapped[int] = mapped_column(Integer, default=0)

    # --- Cached derived performance metrics (recomputed by PerformanceEngine) ---
    current_rating: Mapped[float] = mapped_column(default=0.0)
    current_form_score: Mapped[float] = mapped_column(default=0.0)
    batting_consistency: Mapped[float] = mapped_column(default=0.0)
    bowling_consistency: Mapped[float] = mapped_column(default=0.0)

    team: Mapped[Team | None] = relationship(back_populates="players", foreign_keys=[team_id])
    user: Mapped[User | None] = relationship(back_populates="player_profile")

    @property
    def bat_average(self) -> float | None:
        dismissals = self.bat_innings - self.bat_not_outs
        if dismissals <= 0:
            return None
        return round(self.bat_runs / dismissals, 2)

    @property
    def bat_strike_rate(self) -> float | None:
        if self.bat_balls_faced == 0:
            return None
        return round((self.bat_runs / self.bat_balls_faced) * 100, 2)

    @property
    def bowl_economy(self) -> float | None:
        if self.bowl_balls == 0:
            return None
        overs = self.bowl_balls / 6
        return round(self.bowl_runs_conceded / overs, 2)

    @property
    def bowl_average(self) -> float | None:
        if self.bowl_wickets == 0:
            return None
        return round(self.bowl_runs_conceded / self.bowl_wickets, 2)

    @property
    def bowl_strike_rate(self) -> float | None:
        if self.bowl_wickets == 0:
            return None
        return round(self.bowl_balls / self.bowl_wickets, 2)


class Squad(Base, TimestampMixin):
    """A named subset of team players for a tournament/season (e.g. 'Tournament A Squad')."""
    __tablename__ = "squads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tournament_id: Mapped[int | None] = mapped_column(ForeignKey("tournaments.id"), nullable=True)

    team: Mapped[Team] = relationship(back_populates="squads")
    members: Mapped[list[SquadPlayer]] = relationship(back_populates="squad", cascade="all, delete-orphan")


class SquadPlayer(Base, TimestampMixin):
    __tablename__ = "squad_players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    squad_id: Mapped[int] = mapped_column(ForeignKey("squads.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    is_available: Mapped[bool] = mapped_column(default=True)
    unavailability_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    squad: Mapped[Squad] = relationship(back_populates="members")
    player: Mapped[Player] = relationship()

    __table_args__ = (UniqueConstraint("squad_id", "player_id", name="uq_squad_player"),)
