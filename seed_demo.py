import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import Base, engine, SessionLocal
import app.models
<<<<<<< HEAD
from app.core.bootstrap import ensure_default_accounts
from app.core.config import settings
from app.models.org import Company, Team, Player
from app.models.match import Match, Innings
from app.models.tournament import Tournament
from app.models.enums import PlayingRole, DeliveryOutcome, DismissalType, MatchStatus, TournamentFormat, TossDecision
from app.services.scoring_service import ScoringService, BallInput
from app.services.prediction_engine import PredictionEngine
=======
from app.models.org import Company, Team, Player, User
from app.models.match import Match, Innings
from app.models.tournament import Tournament
from app.models.enums import PlayingRole, DeliveryOutcome, DismissalType, MatchStatus, TournamentFormat, TossDecision, UserRole
from app.services.scoring_service import ScoringService, BallInput
from app.services.prediction_engine import PredictionEngine
from app.core.security import hash_password
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
from datetime import datetime, timezone

Base.metadata.create_all(bind=engine)
db = SessionLocal()

<<<<<<< HEAD
# The app itself creates these two accounts automatically on first startup
# now (see app/core/bootstrap.py) — this just reuses the exact same
# function so this script never creates a second, disconnected company or
# duplicate accounts. This script's actual job is everything AFTER this:
# realistic demo teams/players/matches to explore the analytics engines
# with, which the app has no way to auto-generate for you.
admin_user, umpire_user = ensure_default_accounts(db)
co = db.get(Company, admin_user.company_id)
ADMIN_EMAIL, ADMIN_PASSWORD = settings.DEFAULT_ADMIN_EMAIL, settings.DEFAULT_ADMIN_PASSWORD
UMPIRE_EMAIL, UMPIRE_PASSWORD = settings.DEFAULT_UMPIRE_EMAIL, settings.DEFAULT_UMPIRE_PASSWORD
=======
co = Company(name="Acme Corp"); db.add(co); db.flush()

# A real login-capable admin account — without this, there is literally
# nothing to log into, which is why "add player"/"invite captain" failed
# with "not authenticated": no account existed at all.
ADMIN_EMAIL = "admin@acme.com"
ADMIN_PASSWORD = "admin12345"
admin_user = User(
    email=ADMIN_EMAIL, hashed_password=hash_password(ADMIN_PASSWORD), full_name="Demo Admin",
    role=UserRole.COMPANY_ADMIN, company_id=co.id,
)
db.add(admin_user); db.flush()

# A real login-capable umpire account, for scoring matches from a second device/role.
UMPIRE_EMAIL = "umpire@acme.com"
UMPIRE_PASSWORD = "umpire12345"
umpire_user = User(
    email=UMPIRE_EMAIL, hashed_password=hash_password(UMPIRE_PASSWORD), full_name="Demo Umpire",
    role=UserRole.UMPIRE, company_id=co.id,
)
db.add(umpire_user); db.flush()
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0

strikers = Team(company_id=co.id, name="Acme Strikers", coach_name="R. Sharma")
titans = Team(company_id=co.id, name="Acme Titans", coach_name="V. Kohli")
warriors = Team(company_id=co.id, name="Acme Warriors", coach_name="J. Root")
db.add_all([strikers, titans, warriors]); db.flush()

tourn = Tournament(company_id=co.id, name="Summer Corporate Cup", format=TournamentFormat.ROUND_ROBIN, season_label="2026")
db.add(tourn); db.flush()

def make_player(team, name, role, rating, form, runs=0, wkts=0):
    return Player(team_id=team.id, full_name=name, playing_role=role, current_rating=rating, current_form_score=form,
                  bat_runs=runs, bat_innings=max(1, runs // 30), bowl_wickets=wkts, bowl_matches=max(1, wkts // 2) if wkts else 0)

strikers_players = [
    make_player(strikers, "Rahul Verma", PlayingRole.WICKETKEEPER, 78, 82, runs=412),
    make_player(strikers, "Arjun Mehta", PlayingRole.ALL_ROUNDER, 85, 88, runs=356, wkts=14),
    make_player(strikers, "Karan Singh", PlayingRole.ALL_ROUNDER, 74, 70, runs=298, wkts=9),
    make_player(strikers, "Dev Patel", PlayingRole.BOWLER, 71, 75, wkts=22),
    make_player(strikers, "Aditya Rao", PlayingRole.BOWLER, 68, 60, wkts=17),
    make_player(strikers, "Vikram Joshi", PlayingRole.BATTER, 80, 85, runs=445),
    make_player(strikers, "Nikhil Shah", PlayingRole.BATTER, 69, 65, runs=280),
]
titans_players = [
    make_player(titans, "Suresh Iyer", PlayingRole.WICKETKEEPER, 65, 60, runs=260),
    make_player(titans, "Manoj Kumar", PlayingRole.ALL_ROUNDER, 70, 68, runs=220, wkts=10),
    make_player(titans, "Rohit Nair", PlayingRole.BOWLER, 66, 62, wkts=15),
    make_player(titans, "Amit Das", PlayingRole.BOWLER, 60, 55, wkts=11),
    make_player(titans, "Sanjay Gupta", PlayingRole.BATTER, 72, 74, runs=310),
    make_player(titans, "Rajesh Menon", PlayingRole.BATTER, 63, 58, runs=190),
]
db.add_all(strikers_players + titans_players); db.flush()

# --- Completed match for tournament standings + leaderboards ---
# Simulated via real deliveries (not just Innings totals set directly) so the
# StatisticsEngine's per-match performance rows — which leaderboards read from —
# actually get populated, exactly like a real scored match would.
past_match = Match(team_a_id=strikers.id, team_b_id=titans.id, tournament_id=tourn.id, overs_limit=6,
                    scheduled_at=datetime(2026, 8, 10, 14, 0, tzinfo=timezone.utc), status=MatchStatus.LIVE)
db.add(past_match); db.flush()
pinn1 = Innings(match_id=past_match.id, innings_number=1, batting_team_id=strikers.id, bowling_team_id=titans.id)
pinn2 = Innings(match_id=past_match.id, innings_number=2, batting_team_id=titans.id, bowling_team_id=strikers.id)
db.add_all([pinn1, pinn2]); db.flush()

past_svc = ScoringService(db)


def bowler_for_over(innings_id: int, primary, secondary):
    """Alternates bowlers each over — a bowler can't bowl consecutive overs."""
    over_number = db.get(Innings, innings_id).total_balls // 6
    return primary if over_number % 2 == 0 else secondary


s_bat1, s_bat2 = strikers_players[5], strikers_players[0]  # Vikram, Rahul
t_bowl_a, t_bowl_b = titans_players[2], titans_players[3]  # Rohit, Amit Das
inn1_plan = [DeliveryOutcome.FOUR, DeliveryOutcome.SIX, DeliveryOutcome.ONE, DeliveryOutcome.DOT,
             DeliveryOutcome.FOUR, DeliveryOutcome.TWO, DeliveryOutcome.SIX, DeliveryOutcome.ONE,
             DeliveryOutcome.DOT, DeliveryOutcome.FOUR, DeliveryOutcome.ONE, DeliveryOutcome.SIX,
             DeliveryOutcome.WICKET] + [DeliveryOutcome.ONE, DeliveryOutcome.DOT] * 12
for outcome in inn1_plan:
    if db.get(Innings, pinn1.id).is_completed:
        break
    s_bowl = bowler_for_over(pinn1.id, t_bowl_a, t_bowl_b)
    if outcome == DeliveryOutcome.WICKET:
        past_svc.record_delivery(pinn1.id, BallInput(s_bat1.id, s_bat2.id, s_bowl.id, outcome,
                                  is_wicket=True, dismissal_type=DismissalType.BOWLED, dismissed_player_id=s_bat1.id))
    else:
        past_svc.record_delivery(pinn1.id, BallInput(s_bat1.id, s_bat2.id, s_bowl.id, outcome))
while not db.get(Innings, pinn1.id).is_completed:
    s_bowl = bowler_for_over(pinn1.id, t_bowl_a, t_bowl_b)
    past_svc.record_delivery(pinn1.id, BallInput(s_bat2.id, s_bat1.id, s_bowl.id, DeliveryOutcome.DOT))

t_bat, t_bat2 = titans_players[4], titans_players[0]  # Sanjay, Suresh
s_bowl_a, s_bowl_b = strikers_players[3], strikers_players[4]  # Dev Patel, Aditya Rao
inn2_plan = [DeliveryOutcome.FOUR, DeliveryOutcome.DOT, DeliveryOutcome.ONE, DeliveryOutcome.WICKET,
             DeliveryOutcome.DOT, DeliveryOutcome.DOT] + [DeliveryOutcome.DOT, DeliveryOutcome.ONE] * 13
for outcome in inn2_plan:
    if db.get(Innings, pinn2.id).is_completed:
        break
    s_bowl2 = bowler_for_over(pinn2.id, s_bowl_a, s_bowl_b)
    if outcome == DeliveryOutcome.WICKET:
        past_svc.record_delivery(pinn2.id, BallInput(t_bat.id, t_bat2.id, s_bowl2.id, outcome,
                                  is_wicket=True, dismissal_type=DismissalType.CAUGHT, dismissed_player_id=t_bat.id,
                                  fielder_id=s_bat1.id))
    else:
        past_svc.record_delivery(pinn2.id, BallInput(t_bat.id, t_bat2.id, s_bowl2.id, outcome))
while not db.get(Innings, pinn2.id).is_completed:
    s_bowl2 = bowler_for_over(pinn2.id, s_bowl_a, s_bowl_b)
    past_svc.record_delivery(pinn2.id, BallInput(t_bat2.id, t_bat.id, s_bowl2.id, DeliveryOutcome.DOT))
db.commit()

# --- LIVE match in progress (this is the one the frontend will watch) ---
live_match = Match(team_a_id=strikers.id, team_b_id=warriors.id, tournament_id=tourn.id, overs_limit=20,
                    scheduled_at=datetime.now(timezone.utc), status=MatchStatus.LIVE,
                    toss_winner_team_id=strikers.id, toss_decision=TossDecision.BAT)
db.add(live_match); db.flush()

warriors_kp = make_player(warriors, "Ben Stokes Jr", PlayingRole.WICKETKEEPER, 60, 55)
warriors_bowl = make_player(warriors, "Sam Curran Jr", PlayingRole.BOWLER, 62, 58)
warriors_bowl2 = make_player(warriors, "Josh Little Jr", PlayingRole.BOWLER, 58, 52)
db.add_all([warriors_kp, warriors_bowl, warriors_bowl2]); db.flush()

live_inn1 = Innings(match_id=live_match.id, innings_number=1, batting_team_id=strikers.id, bowling_team_id=warriors.id)
live_inn2 = Innings(match_id=live_match.id, innings_number=2, batting_team_id=warriors.id, bowling_team_id=strikers.id)
db.add_all([live_inn1, live_inn2]); db.flush()

pred_engine = PredictionEngine(db)
pred_engine.compute_pre_match(live_match.id)
db.commit()

svc = ScoringService(db)
hero, partner = strikers_players[5], strikers_players[0]  # Vikram Joshi batting
sequence = [
    DeliveryOutcome.FOUR, DeliveryOutcome.ONE, DeliveryOutcome.DOT, DeliveryOutcome.SIX,
    DeliveryOutcome.ONE, DeliveryOutcome.DOT, DeliveryOutcome.FOUR, DeliveryOutcome.FOUR,
    DeliveryOutcome.DOT, DeliveryOutcome.SIX, DeliveryOutcome.TWO, DeliveryOutcome.ONE,
]
for outcome in sequence:
    over_number = db.get(Innings, live_inn1.id).total_balls // 6
    bowler = warriors_bowl if over_number % 2 == 0 else warriors_bowl2
    svc.record_delivery(live_inn1.id, BallInput(hero.id, partner.id, bowler.id, outcome))
db.commit()

<<<<<<< HEAD
print(f"Demo data added.")
=======
print(f"Seed complete.")
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
print(f"  Live match ID: {live_match.id}  (Strikers vs Warriors — watch this one in the frontend)")
print(f"  Completed match ID: {past_match.id}")
print(f"  Tournament ID: {tourn.id}")
inn = db.get(Innings, live_inn1.id)
print(f"  Live score: {inn.total_runs}/{inn.total_wickets} in {inn.overs_display} overs")
print(f"\n  Log in at /login with:")
print(f"    Email:    {ADMIN_EMAIL}")
print(f"    Password: {ADMIN_PASSWORD}")
print(f"  (Company Admin — can create teams, add players, and generate captain invite links)")
print(f"\n  Or log in as the umpire account:")
print(f"    Email:    {UMPIRE_EMAIL}")
print(f"    Password: {UMPIRE_PASSWORD}")
print(f"  (Umpire — can start and score matches at /score, but not manage teams/players)")
