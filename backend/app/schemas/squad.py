from pydantic import BaseModel


class SquadCreate(BaseModel):
    team_id: int
    name: str
    tournament_id: int | None = None


class SquadOut(BaseModel):
    id: int
    team_id: int
    name: str
    tournament_id: int | None

    class Config:
        from_attributes = True


class SquadPlayerAdd(BaseModel):
    player_id: int


class SquadPlayerOut(BaseModel):
    id: int
    squad_id: int
    player_id: int
    is_available: bool
    unavailability_reason: str | None

    class Config:
        from_attributes = True


class AvailabilityUpdate(BaseModel):
    is_available: bool
    unavailability_reason: str | None = None


class PlayingXISelect(BaseModel):
    """Full playing XI submission for one team in one match. Replaces any
    existing selection for (match_id, team_id) atomically."""
    match_id: int
    team_id: int
    player_ids: list[int]  # exactly 11, in batting_order sequence for the top of the order
    wicketkeeper_id: int
    captain_id: int
    vice_captain_id: int | None = None
    substitute_ids: list[int] = []


class BattingOrderReorder(BaseModel):
    """Drag-and-drop reorder: full ordered list of player_ids for this match+team."""
    match_id: int
    team_id: int
    ordered_player_ids: list[int]


class PlayingXIOut(BaseModel):
    id: int
    match_id: int
    team_id: int
    player_id: int
    batting_order: int | None
    is_substitute: bool
    is_wicketkeeper: bool
    is_captain: bool
    is_vice_captain: bool

    class Config:
        from_attributes = True
