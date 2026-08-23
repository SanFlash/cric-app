"""
Import every model module here so `Base.metadata.create_all()` and Alembic's
autogenerate can discover all tables via a single import of `app.models`.
"""
from app.models.org import User, Company, Team, Player, Squad, SquadPlayer  # noqa: F401
from app.models.invite import TeamInvite  # noqa: F401
from app.models.tournament import Venue, Tournament, TournamentStanding  # noqa: F401
from app.models.match import Match, PlayingXI, Innings, Delivery  # noqa: F401
from app.models.performance import (  # noqa: F401
    BattingPerformance,
    BowlingPerformance,
    FieldingPerformance,
    PlayerForm,
    PlayerRating,
    TeamRating,
    Prediction,
    Achievement,
    Notification,
)
