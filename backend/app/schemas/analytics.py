from pydantic import BaseModel


class PlayerCompareRow(BaseModel):
    player_id: int
    full_name: str
    matches: int
    runs: int
    average: float | None
    strike_rate: float | None
    wickets: int
    economy: float | None
    fielding_dismissals: int
    form: float
    overall_rating: float


class PlayerCompareOut(BaseModel):
    players: list[PlayerCompareRow]


class XISlotOut(BaseModel):
    player_id: int
    full_name: str
    playing_role: str
    current_rating: float
    reason: str


class XIRecommendationOut(BaseModel):
    slots: list[XISlotOut]
    bench: list[XISlotOut]
    warnings: list[str]
    summary: str
