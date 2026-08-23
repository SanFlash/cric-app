from datetime import date
from pydantic import BaseModel, EmailStr, Field

from app.models.enums import PlayingRole, BattingStyle, BowlingStyle, PlayerStatus


class PlayerCreate(BaseModel):
    team_id: int | None = None
    user_id: int | None = None
    full_name: str
    employee_id: str | None = None
    department: str | None = None
    designation: str | None = None
    email: EmailStr | None = None
    contact_number: str | None = None
    date_of_joining: date | None = None
    jersey_number: int | None = None
    profile_image_url: str | None = None
    playing_role: PlayingRole
    batting_style: BattingStyle | None = None
    bowling_style: BowlingStyle | None = None
    preferred_batting_position: int | None = Field(default=None, ge=1, le=11)
    experience_level: str | None = None


class PlayerUpdate(BaseModel):
    team_id: int | None = None
    full_name: str | None = None
    employee_id: str | None = None
    department: str | None = None
    designation: str | None = None
    email: EmailStr | None = None
    contact_number: str | None = None
    jersey_number: int | None = None
    status: PlayerStatus | None = None
    playing_role: PlayingRole | None = None
    batting_style: BattingStyle | None = None
    bowling_style: BowlingStyle | None = None
    preferred_batting_position: int | None = Field(default=None, ge=1, le=11)
    experience_level: str | None = None
    profile_image_url: str | None = None


class PlayerCareerStats(BaseModel):
    bat_matches: int
    bat_innings: int
    bat_runs: int
    bat_balls_faced: int
    bat_not_outs: int
    bat_highest_score: int
    bat_fifties: int
    bat_hundreds: int
    bat_fours: int
    bat_sixes: int
    bat_average: float | None
    bat_strike_rate: float | None

    bowl_matches: int
    bowl_balls: int
    bowl_runs_conceded: int
    bowl_wickets: int
    bowl_maidens: int
    bowl_best_figures: str | None
    bowl_three_fers: int
    bowl_five_fers: int
    bowl_economy: float | None
    bowl_average: float | None
    bowl_strike_rate: float | None

    field_catches: int
    field_run_outs: int
    field_stumpings: int
    field_dropped_catches: int

    class Config:
        from_attributes = True


class PlayerOut(BaseModel):
    id: int
    team_id: int | None
    full_name: str
    employee_id: str | None
    department: str | None
    designation: str | None
    email: EmailStr | None
    contact_number: str | None
    jersey_number: int | None
    profile_image_url: str | None
    status: PlayerStatus
    playing_role: PlayingRole
    batting_style: BattingStyle | None
    bowling_style: BowlingStyle | None
    preferred_batting_position: int | None
    experience_level: str | None
    current_rating: float
    current_form_score: float
    stats: PlayerCareerStats

    class Config:
        from_attributes = True

    @classmethod
    def from_player(cls, player) -> "PlayerOut":
        data = {c: getattr(player, c) for c in [
            "id", "team_id", "full_name", "employee_id", "department", "designation",
            "email", "contact_number", "jersey_number", "profile_image_url", "status",
            "playing_role", "batting_style", "bowling_style", "preferred_batting_position",
            "experience_level", "current_rating", "current_form_score",
        ]}
        data["stats"] = PlayerCareerStats(
            bat_matches=player.bat_matches, bat_innings=player.bat_innings, bat_runs=player.bat_runs,
            bat_balls_faced=player.bat_balls_faced, bat_not_outs=player.bat_not_outs,
            bat_highest_score=player.bat_highest_score, bat_fifties=player.bat_fifties,
            bat_hundreds=player.bat_hundreds, bat_fours=player.bat_fours, bat_sixes=player.bat_sixes,
            bat_average=player.bat_average, bat_strike_rate=player.bat_strike_rate,
            bowl_matches=player.bowl_matches, bowl_balls=player.bowl_balls,
            bowl_runs_conceded=player.bowl_runs_conceded, bowl_wickets=player.bowl_wickets,
            bowl_maidens=player.bowl_maidens, bowl_best_figures=player.bowl_best_figures,
            bowl_three_fers=player.bowl_three_fers, bowl_five_fers=player.bowl_five_fers,
            bowl_economy=player.bowl_economy, bowl_average=player.bowl_average,
            bowl_strike_rate=player.bowl_strike_rate,
            field_catches=player.field_catches, field_run_outs=player.field_run_outs,
            field_stumpings=player.field_stumpings, field_dropped_catches=player.field_dropped_catches,
        )
        return cls(**data)
