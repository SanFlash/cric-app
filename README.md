# Corporate Cricket Team Management & Analytics Platform

A real, running FastAPI backend for the 36-section spec — built in phases,
each one shipped working and functionally tested before moving to the next.
Not a mockup: every claim below was verified by actually running the code
in this environment (see "Verified" under each phase).

## Quickstart (the ONE sequence to follow — start here)

Everything below this section is a phase-by-phase history and detailed
Troubleshooting reference. If you just want it running, ignore the rest of
the doc and run exactly this, in order, from a fresh terminal:

```powershell
# 1. One virtual environment, inside backend\ — not anywhere else
cd path\to\corpcric\backend
python -m venv venv
.\venv\Scripts\Activate.ps1        # you should see (venv) in your prompt
pip install -r requirements.txt

<<<<<<< HEAD
# 2. Start the backend — no seeding step. The app creates its own default
#    login accounts automatically the first time it starts.
=======
# 2. Seed the database — you are now in the REPO ROOT, not backend\
cd ..
Remove-Item -Force .\backend\corpcric.db -ErrorAction SilentlyContinue   # ← never skip this line, even on a "quick" reseed
python seed_demo.py
# → should print "Seed complete." with two logins: admin@acme.com / admin12345
#   (Company Admin) and umpire@acme.com / umpire12345 (Umpire, for scoring)
# → If this errors with "UNIQUE constraint failed", you skipped the Remove-Item line above.

# 3. Start the backend — you MUST cd back into backend\ first, or uvicorn
#    can't find the `app` package and fails with ModuleNotFoundError: No module named 'app'
cd backend
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
python -m uvicorn app.main:app --reload
# → check http://127.0.0.1:8000/health shows {"status":"ok",...}
```

<<<<<<< HEAD
=======
**Steps 2 and 3 switch directories — that's the single most common way this
whole sequence breaks.** After `cd ..` for step 2, you are in the repo
root; step 3 opens with `cd backend` specifically to undo that before
starting the server. Skipping either the `Remove-Item` in step 2 or the
`cd backend` in step 3 produces the two most common errors people hit:
`UNIQUE constraint failed: companies.name` (stale database, didn't
delete it) and `ModuleNotFoundError: No module named 'app'` (ran uvicorn
from the wrong directory). Both are directory/state mistakes, not bugs —
rerun the exact three steps above from a fresh terminal and both go away.

>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
Then, in a **second terminal**:
```powershell
cd path\to\corpcric\frontend
npm install
npm run dev
# → open http://127.0.0.1:5173, log in with admin@acme.com / admin12345
<<<<<<< HEAD
#   (or umpire@acme.com / umpire12345 for the scorer-only account)
```

**No seeding required, ever** — see "Login-ready with zero seeding" below
for exactly what happens on first startup and why. `seed_demo.py` still
exists, but it's now optional: only run it if you specifically want
pre-populated demo teams/players/matches to explore the analytics
engines with. Skipping it entirely, like the sequence above does, gives
you a clean organization with just the two login accounts — the normal
way to actually start using this for real data.

=======
```

>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
**The most common way this goes wrong**: creating a *second* venv
somewhere else and activating that one instead — it won't have
dependencies installed, so you'll get `ModuleNotFoundError`. Use exactly
one venv, at `backend\venv`, always. If you're ever unsure, delete
`backend\venv` entirely and redo step 1 from scratch — that's always safe.

<<<<<<< HEAD
## Login-ready with zero seeding

The backend's startup hook (`app/main.py` → `ensure_default_accounts()` in
`app/core/bootstrap.py`) automatically creates two accounts — and a
company for them to belong to — the first time it ever starts against a
given database, with no manual step required:

| Role | Email | Password |
|---|---|---|
| Company Admin | `admin@acme.com` | `admin12345` |
| Umpire | `umpire@acme.com` | `umpire12345` |

**From there, every "add a team / add a player / start a match" flow
already built into the app is how you populate real data** — there's
nothing seed-script-only about any of it. Log in as the admin, click
"+ New Team", "+ Add Player", generate a captain invite link, create
squads, start matches from "Score a Match." The umpire account can start
and score matches but can't manage teams/players (see the role table in
Troubleshooting below).

**Idempotent, not just on first run** — restarting the backend, or
redeploying it, checks for these accounts by email first and does
nothing if they're already there. **Verified directly**: deleted the
database, started the backend fresh with zero seeding, confirmed both
accounts could log in immediately; restarted the backend against that
same database and confirmed via direct query it was still exactly 2 users
and 1 company, not 4 and 2. Then ran `seed_demo.py` on top of that same
already-bootstrapped database and confirmed it correctly reused the
existing accounts/company instead of creating a second disconnected one
— which is exactly the class of bug (duplicate company) this project hit
once before with the old hardcoded seed script; fixed by having both the
startup hook and `seed_demo.py` share one function instead of each
creating their own.

**Want different credentials than the defaults above?** Every value is a
`Settings` field, overridable via environment variables — set
`DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_UMPIRE_EMAIL`,
`DEFAULT_UMPIRE_PASSWORD`, `DEFAULT_COMPANY_NAME` (in `.env` locally, or
as Render environment variables) before the very first startup — these
only take effect for the accounts that don't exist yet, so changing them
after the defaults have already been created won't retroactively rename
anything.

=======
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
On the frontend, **"Not logged in" in the sidebar is expected**, not an
error — click "Log in". A red **"Couldn't reach the API"** banner means
the backend isn't running or isn't reachable — check `/health` first.

---

## Status: Backend Phases 0–8 complete. Frontend started below.

### Phase 0 — Foundation
- 22 tables across `app/models/` (Users/Companies/Teams/Players/Squads,
  Matches/Innings/Deliveries/PlayingXI, Batting/Bowling/FieldingPerformance,
  PlayerForm/PlayerRating/TeamRating/Prediction, Tournaments/Achievements/Notifications)
- JWT auth + 5-role RBAC (Super Admin → Company Admin → Captain → Player → Viewer)
- `ScoringService` — ball-by-ball recording, live totals, auto-completes
  innings on all-out/overs-limit, sets the chase target
- **Correction-safe stats** (section 31's hardest requirement): a corrected
  delivery supersedes the original row rather than mutating it, rolls back
  live totals, and triggers a full recompute — proven with a wicket
  corrected to a boundary mid-test, career stats recalculated correctly
- WebSocket room per match for the Live Match Center

### Phase 2 — Player CRM & Squad/XI Management
- Full Player CRUD with jersey-clash detection, team transfer, soft-delete
- Squad management: add/remove players, self-service availability marking
- Playing XI selection — atomic replace-the-whole-XI with real validation
  (rejects wrong count, duplicates, keeper/captain not in XI)
- Drag-and-drop batting order reorder endpoint

### Phase 3 — Analytics Core
- `PerformanceEngine` — normalizes raw stats (average, SR, boundary%,
  economy, dot-ball%) into 0–100 sub-metrics against tunable ceilings
- `FormEngine` — section-12 recency-weighted form (last match 30%, prev 2–3
  at 25%, prev 4–5 at 20%, long-term 25%, weights configurable via Settings).
  Verified with a 4-match simulation: form climbed 34.1 → 44.1 → 48.4 → 55.6
  as recent performance improved
- `RatingEngine` — 6-factor weighted overall rating (section 11), re-normalizes
  weights for specialists so a pure bowler isn't penalized for a batting
  score they never had a chance to earn
- `TeamStrengthCalculator` — section 13, recalculates live off the current
  Playing XI rather than a cached value
- All four auto-triggered from `StatisticsEngine.finalize_match` — zero
  manual stat entry, per section 10

### Phase 4 — Win Prediction Engine
- `PredictionEngine.compute_pre_match` — weighted linear model (squad
  rating, recent form, head-to-head record, toss), clamped to 5–95% so
  nothing is ever shown as guaranteed (section 14's explicit requirement)
- `compute_live` — recalculates every delivery once the chase starts,
  anchored to the pre-match baseline, shifted by required-vs-current run
  rate and wickets in hand. Verified with a real chase simulation: 69% →
  49% → 89% as a wicket fell and the required rate spiked — caught and
  fixed an initial overreaction (98%/2% after 2 overs) before shipping
- **Explainability is structural, not bolted on**: every prediction carries
  a `factors` list naming what moved the number and by how much (section 16)
- Wired into the live WebSocket broadcast — a connected client gets
  `win_probability` alongside the scoreboard on every ball
- `momentum_timeline()` — full chronological prediction history for the
  section-15 graph

### Phase 5 — Player Comparison & Smart XI Recommendation
- `GET /analytics/players/compare?player_ids=1,2,3,4` — side-by-side
  comparison of 2–4 players (section 17), rejects out-of-range counts
- `XIRecommendationEngine` (section 18) — rule-based, auditable selection:
  best keeper first, up to 2 best all-rounders (they cover both batting and
  bowling), specialist bowlers to a 5-option bowling target, then best
  remaining batters. Every slot carries a one-line "why" reason, and a
  short-bowling-stock squad correctly surfaces an explicit warning instead
  of silently pretending the XI is balanced — verified with a squad that
  only had 4 real bowling options against a target of 5
- Only pulls from players marked `is_available=True` on the squad, so an
  injured/unavailable player is automatically excluded, not just deprioritized
- Caught and fixed a real bug during testing: the summary line was
  hardcoding "5 bowling options" regardless of what was actually achieved —
  fixed to report the true count

### Phase 6 — Tournaments/Standings & Leaderboards
- `TournamentService` (section 19) — points table with configurable
  win/tie/no-result/loss points (`Settings.POINTS_*`), auto-updated from
  `StatisticsEngine.finalize_match` whenever a completed match belongs to
  a tournament. Standard cricket **NRR** (runs scored/overs faced minus
  runs conceded/overs bowled), accumulated across the whole tournament —
  an all-out innings correctly counts its full allotted overs, not just
  balls actually bowled, matching the real convention
- Verified with a 3-team round-robin (3 matches): produced a self-consistent
  points table (each team 1-1, 2 pts each) with correctly differentiated
  NRR reflecting actual win/loss margins, sorted points-desc-then-NRR-desc
- `LeaderboardService` (section 20) — most runs, highest score, best
  average/strike-rate (with minimum-sample floors so a single knock can't
  top the board), most sixes/fours, most wickets, best economy, best
  bowling figures, most catches/run-outs/stumpings, best form, best overall
  — all computed from per-match performance rows (not cached career
  totals) specifically so they can be filtered by `tournament_id`/`team_id`
- Single flexible endpoint `GET /leaderboards/{metric}` rather than one
  route per stat — verified most_runs/most_wickets/best_economy against
  the same 3-match tournament, all scoped correctly to just those matches
- **Environment fix applied this phase:** upgraded `sqlalchemy` from 2.0.35
  to 2.0.52 in `requirements.txt`. If you're on Python 3.14, see
  Troubleshooting below — 3.14 is new enough that some dependencies don't
  have complete support yet, and the reliable fix is running the backend
  on Python 3.11–3.13 instead.

### Phase 7 — Notifications & Achievements
- `AchievementEngine` (section 24) — scans a player's per-match performance
  rows right after `finalize_match` and awards milestone badges (half
  century / century, 3-wicket / 5-wicket hauls, sub-4-economy with a
  minimum-overs qualifier, 3+ sixes, 2+ fielding dismissals, Player of the
  Match). **Idempotent by design** — checks for an existing
  `(player_id, match_id, code)` row before inserting, so a
  correction-triggered recompute never double-awards. Verified explicitly:
  ran the same check twice, achievement count unchanged
- Fielding credit correctly attributes to the actual fielder, not the
  bowler — verified with a caught dismissal where the non-striker (not the
  bowler) took the catch
- `NotificationService` (section 23) — event-driven, called from the
  natural trigger point in each service rather than polled: match result
  (`finalize_match`), achievement unlocked (`AchievementEngine`), squad
  selection confirmed (`playing_xi` route), availability updated
  (`squads` route). Only creates a notification when the target `Player`
  has a linked `User` account — a player with no login has nowhere to
  receive it, so that's a deliberate skip, not a bug
- Verified end-to-end: a player who scored a century, took 3 wickets, and
  had a teammate take a catch off their bowling correctly received
  achievement notifications for their own feats and a match-result
  notification, with no notification for the fielding dismissal (that
  credit and any notification for it belongs to the actual catcher)

### Phase 8 — AI Insight Layer
- `InsightEngine` (section 26) — generates natural-language insight
  sentences ("Rahul has scored 68% of his runs through boundaries over the
  last 5 matches"), but **every number is read live from stored stats,
  nothing is generated by a language model or invented.** This is
  structural, not a prompt instruction: each `_insight_*` method either
  returns `None` (not enough data) or a string built entirely from values
  it just queried in that same method — there's no free-form generation step
- 5 insight types: boundary reliance, bowling economy trend (recent half
  vs older half of last 5 matches), chase performance vs career average,
  death-overs contribution share, dot-ball pressure percentage. Each has
  its own minimum-sample gate so a 1-match player gets nothing rather than
  a misleading "insight"
- Verified with a brand-new player (0 matches): correctly returned an
  empty list, not fabricated content
- **Caught and fixed a real bug while testing:** the death-overs window
  was hardcoded as an absolute over number (over 16+, i.e. last 4 overs of
  a 20-over match) — which silently produced zero death-overs data for
  any other match length. Fixed to scale with the actual `match.overs_limit`
  (last ~20% of overs) and re-verified the insight now correctly fires for
  a 4-over match. This same fix also corrected the powerplay window used
  by the rating/prediction engines from earlier phases, which shared the
  same hardcoded constant

## Run it

### Requirements
- **Python 3.11, 3.12, or 3.13.** Not 3.14 yet — see Troubleshooting below;
  Python 3.14 (released Oct 2025) is too new for several dependencies
  (SQLAlchemy's ORM typing resolution in particular) to fully support yet.
- PostgreSQL for production; SQLite works fine for local dev with no setup.
  The SQLite file always lives at `backend/corpcric.db`, resolved to an
  absolute path regardless of which directory you run `uvicorn` or
  `seed_demo.py` from — you don't need to `cd` anywhere specific for this
  to work correctly.

### Windows (PowerShell)
```powershell
cd backend
py -3.12 -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload
```
If PowerShell blocks the activation script, run once as admin:
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### macOS / Linux
```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt   # add --break-system-packages only if
                                   # your system Python refuses global installs
cp .env.example .env
uvicorn app.main:app --reload
```

Then open:
- **http://localhost:8000/docs** — interactive Swagger UI, try every endpoint
- **http://localhost:8000/health** — liveness check
- **http://localhost:8000/** — small JSON pointer to the above

## Troubleshooting

**`npm install` fails with `EPERM: operation not permitted, rmdir ...node_modules...`
and/or `ECONNRESET` on Windows.**
This is a OneDrive conflict, not an npm bug. If your project folder lives
inside a OneDrive-synced path (e.g. `OneDrive\Desktop\cric`), OneDrive
locks files mid-write while npm is installing/deleting thousands of small
files in `node_modules`, which corrupts the install and can also manifest
as dropped network connections. **Fix: move the whole project outside any
OneDrive-synced folder** — e.g. `C:\dev\corpcric` — then retry
`npm install`. This isn't a one-time fluke; it recurs on every install as
long as the project stays inside OneDrive. If you can't move it, at minimum
right-click the project folder → "Always keep on this device" and pause
OneDrive sync before running `npm install`.

**`'vite' is not recognized as an internal or external command`.**
Downstream of the failure above — `npm install` didn't finish, so
`node_modules\.bin\vite` was never created. Fix the OneDrive issue first,
delete any partial `node_modules` folder, then `npm install` again; this
resolves itself once the install completes cleanly.

**`python seed_demo.py` — "can't open file ... No such file or directory".**
`seed_demo.py` lives at the repo root, not inside `frontend`. Run it from
the top-level project folder: `cd corpcric` (or wherever you cloned it),
then `python seed_demo.py` — not from inside `frontend`.

**`sqlite3.OperationalError: no such column: users.team_id` (or any
"no such column" error), or `sqlite3.IntegrityError: UNIQUE constraint
failed: companies.name` (or any UNIQUE constraint error) when running
`seed_demo.py`.**
Both are the same root cause: `backend\corpcric.db` already had data in
it, and you skipped deleting it before reseeding. The "no such column"
version means the old file predates a model change (an `ALTER TABLE`
that `create_all()` never performs — see below). The "UNIQUE constraint"
version means the old file already has a company named "Acme Corp" in
it, and the seed script tried to insert a duplicate.

It happens because this project uses `Base.metadata.create_all()` for
local dev convenience (see the note in `main.py`) instead of real
migrations: on startup it creates any *missing tables*, but it never
*alters an existing table* to add a new column, and it never touches
existing rows either. If your `corpcric.db` predates a model change
(exactly what happened when `users.team_id` was added for the
captain-invite feature) or already has seed data in it, the running
server just keeps using the old shape/data forever, no matter how many
times you restart it.

Two things, together:
1. **Delete the stale database and reseed** — `backend/corpcric.db` (not
   `backend/uploads/`, just the `.db` file), then run `python
   seed_demo.py`, then start the backend. This always fixes the immediate
   error, whatever it is.
2. **This codebase now pins the database file's location** so this class
   of bug is structurally harder to hit going forward: `DATABASE_URL`
   used to default to the relative path `sqlite:///./corpcric.db`, which
   resolves differently depending on *which directory you happened to
   launch Python from*. Launch `uvicorn` from `backend/` and
   `seed_demo.py` from the repo root (exactly what earlier instructions
   in this README told you to do) and you'd silently get **two different
   database files** — the server keeps reading its old one no matter how
   often you reseed the other one. Fixed: `app/core/config.py` now
   computes an absolute path anchored to the `backend/` folder itself, so
   `uvicorn`, `seed_demo.py`, and any other script always agree on the
   same file regardless of your current directory. Verified by seeding
   from three different working directories (repo root, `backend/`, and
   an unrelated `/tmp`) and confirming all three write to the exact same
   `backend/corpcric.db`.

If you pull future code changes to this project and hit a "no such
column"/"no such table" error again, the fix is always the same: delete
`backend/corpcric.db` and reseed. This is a `create_all()`-based dev
setup, not a migrated one — schema changes never retrofit an existing
database file.

**`ModuleNotFoundError: No module named 'app'` when starting the backend.**
You ran `uvicorn app.main:app` from the wrong directory. The `app`
package only exists inside `backend/` — if your terminal is sitting in
the repo root (or anywhere else) when you run this command, Python can't
find it. This commonly happens right after running `seed_demo.py`
(which must be run from the repo root), if you forget to `cd backend`
before starting the server afterward. Fix: `cd backend` (from the repo
root: `cd backend`; check with `pwd` on Mac/Linux or just look at your
prompt on Windows — it should end in `...\corpcric\backend`), then retry
`python -m uvicorn app.main:app --reload`.

**Login fails with "Incorrect email or password" even though you're using
the exact credentials `seed_demo.py` just printed.**
This happens if you reseed (which deletes and recreates `corpcric.db`)
*while the backend server is still running from before*. SQLite processes
that already have the file open keep using the old (now-deleted) file
handle on Linux/Mac, or Windows may throw a file-lock error instead — either
way, the running server never sees your new data. **Fix: always restart
the backend *after* reseeding, never before.** Sequence that works:
`python seed_demo.py` → *then* start (or restart) `uvicorn`. If you're
unsure whether the backend picked up a fresh seed, just restart it —
it's cheap and eliminates the whole class of bug.

**`TypeError: descriptor '__getitem__' requires a 'typing.Union' object but received a 'tuple'` on startup, traced into `sqlalchemy/util/typing.py`.**
You're running Python 3.14. Python 3.14 changed `typing.Union` internals
(merged it with `types.UnionType` into a C implementation), which breaks
older SQLAlchemy's runtime resolution of `Mapped[SomeModel | None]`
forward-reference annotations. Fix, in order of preference:
1. Use Python 3.11–3.13 instead (`py -3.12 -m venv venv` on Windows,
   `python3.12 -m venv venv` elsewhere) — the reliable fix, since several
   other dependencies are also still catching up to 3.14.
2. If you must stay on 3.14, make sure `requirements.txt` pins
   `sqlalchemy==2.0.52` (or newer) — already applied in this codebase — and
   re-`pip install -r requirements.txt`. This may not fully resolve every
   case since the underlying CPython 3.14 typing regression is still being
   patched across the ecosystem as of this writing.

**`passlib`/`bcrypt` errors on login/register (e.g. `AttributeError: module 'bcrypt' has no attribute '__about__'`).**
`passlib[bcrypt]==1.7.4` breaks against `bcrypt>=4.1`. `requirements.txt`
already pins `bcrypt==4.0.1` right after the `passlib` line — if you see
this, your installed `bcrypt` drifted; `pip install bcrypt==4.0.1` to fix.

**`ModuleNotFoundError` for `email_validator` or `httpx`.**
Both are in `requirements.txt` (`email-validator` is needed by Pydantic's
`EmailStr`, `httpx` only if you run the test snippets in this repo via
`TestClient`) — re-run `pip install -r requirements.txt` if you edited the
file or installed packages manually.

## Structure

```
backend/app/
  core/       config.py (all tunable weights/ceilings live here), database.py, security.py (JWT/bcrypt)
  models/     org.py (User/Company/Team/Player/Squad), match.py (Match/Innings/Delivery/PlayingXI),
              invite.py (TeamInvite — captain self-onboarding tokens),
              performance.py (Batting/Bowling/Fielding + Form/Rating/Prediction/Achievement/Notification),
              tournament.py, enums.py, mixins.py
  services/   scoring_service.py       — ball-by-ball + corrections
              statistics_engine.py     — recompute pipeline, orchestrates the cascade below
              performance_engine.py    — raw stats -> 0-100 sub-metrics
              form_engine.py           — recency-weighted form (section 12)
              rating_engine.py         — 6-factor overall rating (section 11)
              team_strength.py         — XI-based team strength (section 13)
              prediction_engine.py     — pre-match + live win probability (sections 14-16)
              xi_recommendation.py     — analytics-based squad selection (section 18)
              tournament_service.py    — points table + NRR (section 19)
              leaderboard_service.py   — batting/bowling/fielding/overall leaderboards (section 20)
              achievement_engine.py    — automatic milestone badges (section 24)
              notification_service.py — event-driven notifications (section 23)
              insight_engine.py        — AI insight sentences from verified stats only (section 26)
  api/routes/ auth.py, teams.py, players.py, squads.py, playing_xi.py, analytics.py,
              tournaments.py, leaderboards.py, notifications.py, uploads.py, invites.py, matches.py
  ws/         live_match.py (per-match broadcast rooms)
```

## API surface so far

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/login`, `/refresh`, `GET /auth/me` |
| Teams | `GET/POST /teams`, `GET /teams/{id}` |
| Players | `GET/POST /players`, `GET/PATCH/DELETE /players/{id}`, `POST /players/{id}/transfer` |
| Squads | `GET/POST /squads`, `GET/POST/DELETE /squads/{id}/players`, `PATCH .../availability` |
| Playing XI | `GET/PUT /playing-xi`, `PATCH /playing-xi/batting-order` |
| Matches | `GET/POST /matches`, `GET /matches/{id}`, `GET /matches/{id}/innings`, `GET /matches/{id}/roster` |
| Scoring | `POST /matches/deliveries` (broadcasts scoreboard + live win% over WS) |
| Analytics | `GET /analytics/players/{id}/rating`, `GET .../form`, `GET /analytics/teams/{id}/strength`, `POST /analytics/matches/{id}/predictions/pre-match`, `GET .../predictions/momentum`, `GET .../predictions/latest`, `GET /analytics/players/compare`, `GET /analytics/squads/{id}/recommend-xi` |
| Tournaments | `GET/POST /tournaments`, `GET /tournaments/{id}/standings` |
| Leaderboards | `GET /leaderboards/{metric}` (see full metric list in the route docstring) |
| Notifications | `GET /notifications`, `PATCH /notifications/{id}/read` |
| Achievements | `GET /analytics/players/{id}/achievements` |
| AI Insights | `GET /analytics/players/{id}/insights` |
| Live | `WS /ws/matches/{match_id}` |

## Design decisions worth knowing about

- **Everything derived is a snapshot table, not a mutated field.**
  `PlayerForm`, `PlayerRating`, `TeamRating`, `Prediction` are all
  append-only time series. `Player.current_rating` etc. are cached copies
  of the latest snapshot for fast reads — the snapshots are the source of
  truth, which is what makes the timeline/graph endpoints (sections 4, 15)
  free (just a query, no recomputation).
- **All weights and ceilings live in `app/core/config.py`** as `Settings`
  fields (rating weights, form recency buckets, batting/bowling
  normalization ceilings) — tune per league/format without touching engine code.
- **The prediction model is deliberately the "Phase 1 transparent
  statistical model"** the spec calls for in section 33, not a black box.
  An ML model (logistic regression / XGBoost) is a drop-in replacement for
  `PredictionEngine.compute_pre_match`'s internals later — the `Prediction`
  table schema and `factors` JSON column don't need to change for that upgrade.

## Environment quirks hit and fixed along the way

- `passlib[bcrypt]==1.7.4` breaks against newer `bcrypt` — pinned
  `bcrypt==4.0.1` in `requirements.txt`.
- SQLAlchemy `DateTime(timezone=True)` columns can come back naive in some
  code paths; `FormEngine`'s match-sorting normalizes before comparing.

## What's left from the 36-section spec

1. **React/TS PWA frontend (28–29)** — Dashboard, Live Match, and
   Leaderboards built and verified against the real running backend (see
   Frontend section below). Remaining nav items (Teams, Players, Squads,
   Tournaments, Predictions, Notifications, Settings) are scaffolded as
   "Coming soon" in the sidebar but not built yet.
2. Formal pytest suite, seed/demo data, CI, deployment hardening (36)

Each prior phase was built, run, and functionally verified before moving on
— that continues for the remaining phases.

---

# Frontend

A Vite + React + TypeScript + Tailwind v4 app in `/frontend`, wired to the
real backend API — nothing in it is mocked. Verified by actually running
both servers together, seeding real match data, and screenshotting the
result (see "Verified" notes below each page).

## Design

Deliberately not the generic AI-dashboard defaults (cream+terracotta,
near-black+neon, or broadsheet hairlines). The brief is a corporate cricket
platform, so the identity comes from cricket's own vernacular:

- **Palette** — night-pitch charcoal-green (`#0a1210` → `#24332b`),
  scoreboard-amber accent (`#f2a93b`), cricket-ball crimson for
  wickets/alerts (`#c1272d`), pitch-green for wins (`#4c9a5b`). Full token
  list in `frontend/src/index.css` under `@theme`.
- **Type** — Space Grotesk (display), Inter (body), **JetBrains Mono for
  every number** — scores, rates, percentages, leaderboard values — so data
  reads like it's actually on a stadium board, not just styled text.
- **Signature element** — `ScoreboardValue` (`components/Scoreboard.tsx`):
  each digit flips on a CSS `rotateX` transform when its value changes,
  like a real LED scoreboard, not just a re-render.

## Pages built

- **Dashboard** (`/`) — animated count-up stat cards, most-runs/most-wickets
  leaderboard panels, team grid. **Verified**: screenshotted against seeded
  data — 3 teams, 65 top-5 runs, real player names (Vikram Joshi 47 runs,
  Sanjay Gupta 18, Suresh Iyer 0) ranked correctly.
- **Live Match** (`/live/:matchId?`) — the flip-digit scoreboard, animated
  win-probability bar, momentum area chart, connects to the real
  `/ws/matches/{id}` room from Phase 0. **Verified**: watched match ID 2
  showing `29/0`, `Innings 1`, `Overs 2.0`, `RR 14.50`, `Team A 63% / Team B
  37%` — all pulled from the live backend, not placeholder values.
- **Leaderboards** (`/leaderboards`) — metric switcher across all 10
  backend metrics, amber top-3 badges. **Verified**: same real data as the
  Dashboard panels, correctly re-fetches on metric change.

## Real bugs found and fixed while verifying this phase

Screenshotting against a live backend (rather than trusting a clean `npm
run build`) surfaced three actual bugs — this is exactly why that extra
step was worth it:

1. **Empty leaderboards.** The demo seed script set `Innings.total_runs`
   directly instead of playing real deliveries through `ScoringService` —
   so zero `Delivery` rows existed and the stats engine correctly found
   nothing to aggregate. Not a stats-engine bug (proven correct in earlier
   phases); a seed-script bug. Fixed by having the seed script actually
   simulate ball-by-ball scoring.
2. **Live Match showed nothing until the next ball.** The WebSocket only
   ever broadcast on new deliveries — a client connecting mid-match saw a
   blank screen until someone happened to bowl the next ball. Fixed:
   `ws/live_match.py` now sends a snapshot of current state immediately on
   connect (`_current_snapshot`).
3. **That snapshot picked the wrong innings.** Both `Innings` rows exist
   from the moment a match starts (so the 2nd innings' target can be set
   later), so naively picking "highest `innings_number`" showed an empty
   not-yet-started 2nd innings while the 1st was still live at 29/0. Fixed
   to prefer the innings that actually has deliveries recorded.

Also addressed: a 771KB single JS bundle (Tailwind + Framer Motion +
Recharts + all three pages in one chunk) — converted routes to
`React.lazy()` + `Suspense`, splitting Recharts (the heaviest dependency,
only used by Live Match) out of the initial bundle. Main chunk dropped to
353KB; `LiveMatch`'s own chunk (361KB, carries Recharts) only loads when
you actually visit that route.

## Run it

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api and /ws to :8000
```

Requires the backend running on `:8000` (see backend setup above) — the
Vite dev server proxies `/api/*` and `/ws/*` there (`vite.config.ts`).

To see real data rather than empty states, seed some first:
```bash
# from the repo root, with the backend's venv active
python seed_demo.py
```
This creates 3 teams, a tournament, a completed match (played out via real
`ScoringService` deliveries so stats/leaderboards populate), and a live
in-progress match at 29/0 — the exact data used to verify the screenshots
above.

## Troubleshooting (frontend)

**Uploaded team logos / player photos never display, anywhere in the app.**
Real bug, found and fixed: `vite.config.ts`'s dev-server proxy only
forwarded `/api` and `/ws` to the backend — not `/uploads`, where
uploaded images are actually served from. An `<img src="/uploads/...">`
was silently requesting from the Vite dev server itself (which has no
such file, 404s) instead of the backend. Fixed by adding `/uploads` to
the proxy config. If you're still on an older copy of this project,
add this to `frontend/vite.config.ts`:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000',
    '/uploads': 'http://localhost:8000',   // ← this line was missing
    '/ws': { target: 'ws://localhost:8000', ws: true },
  },
},
```
**Requires a full restart of `npm run dev`** — proxy config is read once
at server startup, not hot-reloaded like component code.

**`npm install` fails with `EPERM`/`ECONNRESET`, or `vite` is "not
recognized" afterward.** See the backend Troubleshooting section above —
this is almost always a OneDrive-synced-folder conflict on Windows, not an
npm or Vite problem. Move the project out of OneDrive and retry.

**Fonts look like system defaults, not Space Grotesk/JetBrains Mono.**
`index.css` loads fonts via a Google Fonts `@import`, which needs internet
access. Sandboxed/restricted-network environments (like the one used to
build this) block `fonts.googleapis.com` — the app still works and looks
right structurally, just falls back to system fonts for type. Real
deployments with normal internet access won't hit this.

**Screenshots or automated checks show a blank/half-rendered page even
though the app works when you click around manually.** This happened
during development: raw `chrome --headless --screenshot` CLI captures
raced the paint/animation and produced false-negative blank screenshots,
while Playwright's CDP-based `page.screenshot()` after
`wait_until="networkidle"` showed the true, fully-rendered state every
time. If you're scripting screenshot-based checks against this app, prefer
Playwright/Puppeteer over the raw CLI flag.

## Not built yet

Predictions/Notifications/Settings pages (sidebar shows them as "Coming
soon"), a Register page (currently: log in with the seeded admin, or
accept a captain invite — there's no public "create a new company admin
account" flow), PWA manifest + service worker, mobile-responsive
breakpoints, and the drag-and-drop batting-order UI for the Playing XI
endpoints from Phase 2.

## Pages added: Score + Scorer (ball-by-ball live scoring)

The biggest gap the frontend had until now: everything downstream of
scoring (leaderboards, ratings, predictions, achievements) worked, but
there was **no way to create a match or score a ball through the UI at
all** — only pre-seeded data via `seed_demo.py`. Fixed with two new
pieces, plus a backend gap this closed along the way (there was no
`POST /matches` endpoint at all — only `POST /matches/deliveries` existed,
with no way to create the match/innings being scored into).

- **New role: Umpire.** Added `UMPIRE` to the `UserRole` enum, alongside
  Company Admin and Captain, as a role that can create and score matches
  but not manage teams/players/invites. `seed_demo.py` now creates a demo
  umpire account (`umpire@acme.com` / `umpire12345`) alongside the admin one.
- **`POST /matches`** (new) — creates a Match plus both Innings rows up
  front (innings 2's target can only be set once innings 1 completes, and
  the live-scoreboard snapshot logic already expects both to exist from
  match start). Batting order is derived from the toss winner + decision
  if provided, else Team A bats first by default. **Verified**: created a
  match with Team A winning the toss and choosing to bat — confirmed via
  the innings API that Team A was correctly set as the first-innings
  batting team.
- **Score** (`/score`) — list of matches with Watch/Score links, "+ New
  Match" modal (two teams, overs, optional toss). Gated to
  Admin/Captain/Umpire roles; other roles see an explanatory message
  instead of a non-functional button.
- **Scorer** (`/score/:matchId`) — the actual ball-by-ball control panel:
  striker/non-striker/bowler pickers, run buttons (0/1/2/3/4/6, with
  4s/6s in amber), extras (Wide/No Ball/Bye/Leg Bye), and a Wicket flow
  (dismissal type, striker-or-non-striker picker, fielder selector for
  caught/run-out/stumped). Basic strike rotation on odd runs. Shows the
  same live scoreboard the viewer sees, plus a last-6-balls ticker, so the
  scorer gets the same instant confirmation as everyone else watching.

### Verified: real-time sync across two genuinely separate browser sessions

This was the actual point of the feature, so it's the part I verified most
carefully — not with one browser tab, but two **fully separate Playwright
browser contexts** (no shared cookies, storage, or session — as close to
"two different devices" as this environment can simulate):

1. **Device 1** (Umpire, logged in): created a new match through the real
   UI, landed on the Scorer.
2. **Device 2** (completely unauthenticated, different browser context):
   opened `/live/{matchId}` for that same match. Screenshotted: `0/0`,
   sidebar correctly showing "Not logged in".
3. Back on **Device 1**: selected striker/non-striker/bowler, scored a 4
   then a 6 — zero interaction on Device 2 at any point.
4. Screenshotted **Device 2 again, with no refresh, no click, nothing**:
   `10/0`, `Overs 0.2`, `RR 30.00` — exactly the 4+6 just scored on the
   other session, arrived automatically over the existing WebSocket
   broadcast from Phase 0/4.
5. Also verified the Wicket flow end-to-end (dismissal type → fielder →
   confirm): score correctly moved to `10/1` with a red "W" ball indicator.

Zero console errors across the entire sequence. One test-script mistake
caught along the way and worth noting because it demonstrates a real
guard working correctly: clicking WICKET before selecting any players
correctly refused to submit and kept the dialog open with an explanatory
message, rather than sending an incomplete delivery to the backend.

## Added: team logos, player photos, bowler rotation, and broadcast-driven animations

**Scope note, upfront:** "3D HQ animation" of players physically running
was requested. Actual rigged 3D character animation needs a completely
different pipeline — 3D models, skeletal rigs, a real-time 3D engine like
Three.js — that's a separate project, not something built well as an
add-on here. What's built instead is **deliberately high-quality 2D/SVG
motion design**: runners sprinting between creases for 1s/2s/3s, the ball
racing to the boundary rope for a four, arcing over the ground for a six,
stumps shattering on a wicket. The part that actually matters most —
**everyone watching sees the identical animation at the identical
moment** — works the same either way, because it's driven by the
WebSocket broadcast payload, not computed independently on each client.

- **New bowler-per-over enforcement, backend-side, not just UI.**
  `ScoringService.record_delivery` now rejects the same bowler being
  selected for two overs in a row with a real `ValueError` → clean 400,
  checked against the actual delivery history (not client-trusted state).
  **Verified via direct API calls**: bowled a full over with bowler A,
  attempted over 2 with bowler A again → correctly rejected
  (`"Same bowler cannot bowl consecutive overs"`); retried with bowler B →
  succeeded. This also broke `seed_demo.py`, which had been using a single
  bowler for an entire multi-over innings — fixed the seed script to
  alternate bowlers per over, which is more realistic anyway.
- **Team logos** now render in the Scorer header (both teams) and the
  Live Match Center header (next to the LIVE badge) — pulled from the
  same `Team.logo_url` the admin/captain upload flow already populates.
- **Player photos** now render as avatars next to every striker/
  non-striker/bowler picker in the Scorer (photo if uploaded, initial-letter
  fallback otherwise) — the same `profile_image_url` data that was
  previously only visible on the Team roster table.
- **Over-completion bowler prompt.** The WS broadcast now carries an
  `event` object with every delivery (`outcome`, `is_wicket`,
  `dismissal_type`, `runs_batter`, and — critically — `over_completed` +
  `previous_bowler_id`). When an over completes, the Scorer automatically
  clears the bowler selection, excludes the just-finished bowler from the
  dropdown, and disables every scoring button until a valid new bowler is
  confirmed. **Verified**: bowled a full over, screenshotted the resulting
  state — score correctly frozen at the over boundary, last-6-balls
  ticker showing the complete over, amber prompt exactly as designed, all
  buttons visibly disabled.
- **`BallAnimation` component** — reads the same broadcast `event`,
  renders the matching 2D sequence (runners/four/six/wicket/extra/dot),
  auto-dismisses after ~1.6–2.4s depending on event type, and is mounted
  on **both** the Scorer and the Live Match Center pages, keyed by
  `delivery_id` so it correctly replays on every new ball rather than
  only the first.

### Verified: the animation actually fires identically on two separate devices, mid-flight

Screenshotted **both** sessions ~600ms into the same six's animation:
- **Scorer (Device 1, the umpire who just clicked "6")**: ball glowing,
  partway through its arc.
- **Live Match Center (Device 2, a completely separate, unauthenticated
  browser context that did nothing but sit on the page)**: the same ball,
  further along the same arc trajectory, `6/0` on screen, page title now
  correctly showing "Acme Strikers vs Acme Warriors" (previously
  hardcoded "Team A"/"Team B" — fixed as part of this pass since team
  names are now actually fetched).

That's the real proof this isn't a client-side visual trick playing
independently on each screen — it's one broadcast event driving identical
motion on every connected client, scorer and viewers alike.

## Added: squad-scoped scoring, a Predictions page, and distinct extras animations

## Deploying to Render (from GitHub)

`render.yaml` at the repo root defines everything as one Blueprint: the
backend (native Python runtime, no Docker), the frontend (static site),
and a free Postgres database. Two things had to be fixed before this
could work at all, worth knowing about:

1. **The frontend hardcoded same-origin API calls.** `client.ts`'s base
   URL and the WebSocket connection both assumed the frontend and backend
   shared a domain — true in local dev only because Vite's proxy hides
   it. On Render, the static site and the API are genuinely different
   domains. Fixed: an optional `VITE_API_URL` build-time env var now
   drives the API base URL, the WebSocket origin, and every uploaded
   image URL (`resolveUploadUrl()` in `client.ts`) — empty by default, so
   local dev is unaffected. **Verified for real**: built the frontend
   with `VITE_API_URL` pointing at a backend on a different port, served
   it from yet another port, logged in, and confirmed via network
   inspection that all 19 API requests genuinely crossed origins
   correctly — not assumed from reading the code.
2. **Client-side routing needs a rewrite rule.** Directly loading
   `/login` or `/teams/5` on a plain static file server 404s, because the
   server looks for a literal file at that path instead of serving
   `index.html` and letting React Router take over. `render.yaml`'s
   frontend service includes the required rewrite rule
   (`/* → /index.html`) — confirmed this exact failure mode by
   reproducing it locally first (a raw `python -m http.server` 404s on
   `/login`; the app works once you land on `/` and navigate client-side).

### Steps

1. **Push this repo to GitHub** (if not already there).
2. **Render Dashboard → New → Blueprint.** Connect your GitHub account,
   pick the repo. Render reads `render.yaml` automatically and shows you
   three resources: `corpcric-api`, `corpcric-web`, `corpcric-db`.
3. **Click "Apply"** to create all three. First deploy takes a few
   minutes — the backend installs Python deps and the frontend runs
   `npm install && npm run build`.
4. Once both are live, **note their actual URLs** from the Render
   dashboard (e.g. `https://corpcric-api-xxxx.onrender.com` and
   `https://corpcric-web-xxxx.onrender.com` — Render appends a random
   suffix if the plain name is taken).
5. **Backend → Environment tab** → add a new variable:
   `CORS_ORIGINS` = `["https://corpcric-web-xxxx.onrender.com"]`
   (the frontend's real URL, as a JSON array string — this is exactly
   how `Settings.CORS_ORIGINS` parses env vars; confirmed locally before
   writing this).
6. **Frontend → Environment tab** → add:
   `VITE_API_URL` = `https://corpcric-api-xxxx.onrender.com`
   (the backend's real URL, **no trailing slash**). Since this is baked
   into the JS bundle at build time, also click **"Manual Deploy" →
   "Clear build cache & deploy"** on the frontend service afterward — a
   plain restart won't pick up the new value, only a rebuild will.
<<<<<<< HEAD
7. **No seeding step needed.** The backend creates its own login-ready
   default accounts (`admin@acme.com` / `admin12345` and
   `umpire@acme.com` / `umpire12345`) automatically on first startup —
   see "Login-ready with zero seeding" earlier in this doc. If you *want*
   pre-populated demo teams/players/matches to explore with, that's still
   optional via Render's **Shell** tab on the backend service:
=======
7. **Seed the database.** Render's free Postgres has no shell access from
   your machine directly, but you can run the seed script from Render's
   own shell: Backend service → **Shell** tab →
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
   ```bash
   python /opt/render/project/src/seed_demo.py
   ```
   (adjust the path if Render's checkout root differs — check with `pwd`
<<<<<<< HEAD
   and `ls` in that shell first).
8. Visit your frontend URL and log in with the admin credentials above.
   Confirm the Dashboard loads (it'll show an empty state — "No teams
   yet" — until you add real ones, which is correct). If it shows
   "Couldn't reach the API" instead, the `VITE_API_URL` rebuild in step 6
   either didn't happen or used the wrong URL.
=======
   and `ls` in that shell first; `seed_demo.py` lives at the repo root,
   one level up from `backend/`).
8. Visit your frontend URL, log in with the seeded admin credentials
   (printed by the seed script), and confirm the Dashboard loads with
   real data. If it shows "Couldn't reach the API," the `VITE_API_URL`
   rebuild in step 6 either didn't happen or used the wrong URL.
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0

### Two real limitations, not fixed, worth knowing before you rely on this

- **Uploaded images won't survive a redeploy.** `backend/uploads/` is
  local disk — Render's free tier has no persistent disk, and even paid
  disks reset on some deploy types. Every push that redeploys the backend
  wipes previously uploaded team logos and player photos. For anything
  beyond a demo, this needs real object storage (S3, Cloudflare R2,
  Render's own disk add-on) — not implemented here; `main.py` has a
  comment flagging exactly this since Phase 9.
- **Render's free web services spin down after 15 minutes of
  inactivity** and take ~30-60 seconds to wake back up on the next
  request. Expect a slow first load after any idle period — this is a
  Render free-tier behavior, not a bug in the app.

### If you'd rather use Docker after all

The original Docker-based setup (`backend/Dockerfile`, `.dockerignore`)
is still in the repo and still works — swap `env: python` +
`buildCommand`/`startCommand` back to `env: docker` +
`dockerfilePath: ./backend/Dockerfile` + `dockerContext: ./backend` in
`render.yaml` if you prefer that path. Both were verified working in
this project; native Python is simpler to reason about and was requested
specifically, so it's the default in the committed `render.yaml`.

## Mobile responsiveness — audited at a real phone viewport, not just resized

Turned out Tournament creation, Quick Match, and a full mobile
hamburger/drawer layout (`Layout.tsx`) were **already built** in earlier
work — this round's job was auditing whether they (and everything else)
actually hold up at real phone widths, not building from scratch.

Tested every major page at 390×844 (iPhone 13) with Playwright's mobile
emulation (`is_mobile`, `has_touch`), checking both for horizontal page
overflow (`scrollWidth > clientWidth`) and by actually looking at each
screenshot — a page can pass the overflow check while still being
cramped or silently hiding content, which is exactly what happened here:

- **Dashboard, Teams, Players, Squads, Leaderboards, Predictions, Score,
  Live Match, Player Detail, Squad Detail** — all confirmed clean: zero
  horizontal overflow, grids correctly collapse to 1–2 columns, the
  hamburger drawer opens/closes correctly and highlights the active page.
- **Scorer** — verified the run-button grid reflows from 6 columns
  (desktop) to 3 (mobile) rather than staying cramped, player pickers
  stack full-width, all correctly thumb-sized.
- **Real bug found and fixed**: the Team Detail and Tournament Standings
  tables (`grid-cols-12` inside `overflow-x-auto` containers) passed the
  page-level overflow check — because the scroll is correctly contained
  to the table itself, not leaking into the page — but a static
  screenshot showed the Runs/Avg/Wickets/Form/Rating columns simply cut
  off with **no visual indication the table scrolls at all**. Verified
  the data wasn't actually lost by programmatically scrolling the
  container and confirming every column renders correctly further right
  — so the fix wasn't "make it scroll" (it already did), it was "tell
  the user it scrolls": added a `"Swipe table for runs, wickets, form &
  rating →"` hint above both tables, mobile-only (`md:hidden`), styled to
  match the design system.

## Fixed: uploaded images invisible everywhere, and a fragile team-creation assumption

Two real bugs reported and fixed:

1. **Uploaded images never displayed** — see the Troubleshooting entry
   above for the full diagnosis (missing `/uploads` proxy rule in
   `vite.config.ts`). Verified with a real visible test image (a 64×64
   solid amber PNG, not the earlier 1×1-pixel test fixture that made an
   *unrelated* team's logo box look blank in a screenshot but was actually
   fine): uploaded, displayed correctly immediately, **and survived a
   full cold page reload**, confirming it's genuinely being served from
   the backend rather than a transient blob-URL preview.
2. **Team creation used a hardcoded `company_id: 1`** in `Teams.tsx`
   instead of the logged-in admin's actual company. Harmless on a fresh
   single-company seed (where company 1 and the admin's company happen to
   coincide) but wrong in general — any setup with more than one company,
   or a company ID that drifted from 1 for any reason, would either 403
   or silently create the team under the wrong company. Fixed to use
   `user.company_id` from the authenticated session via `useAuth()`, with
   a clear error message if a logged-in user somehow has no company
   linked at all, instead of failing silently or wrongly.

- **Squad-scoped bowler/batter selection.** `Match` now has optional
  `squad_a_id`/`squad_b_id`. When creating a match, picking a squad for a
  team scopes the Scorer's striker/non-striker/bowler pickers to that
  squad's *available* players only (`GET /matches/{id}/roster?team_id=`);
  no squad selected falls back to the full team roster, so nothing breaks
  for matches that don't use squads. **Verified**: created a squad with
  exactly 2 players, linked it to a new match, confirmed the striker
  dropdown had exactly 3 options (2 players + placeholder) — not the full
  7-player team roster. A small "⬤ Striker/Non-striker limited to squad"
  indicator shows in the Scorer so it's not a silent restriction.
- **Predictions page** (`/predictions`) — match switcher, win-probability
  bar, the explainability factors list (section 16's "why", not just a
  number), momentum chart, and a "Compute pre-match prediction" button for
  matches that don't have one yet. **Verified**: computed a real
  prediction (68%/32%) with real factors ("Stronger overall squad rating
  (72.3 vs 44.8)", "Better recent batting/bowling form"), both correctly
  attributed to the stronger team.
- **Three distinct extras animations**, replacing one generic badge:
  `WideAnim` (ball drifts wide + umpire arm-signal line), `NoBallAnim`
  (flashing red foot-fault line + "free hit" note), `ByeAnim` (ball
  deflects behind the keeper, a runner still crosses). **Verified**:
  screenshotted all three in sequence on the same delivery stream —
  visually distinct from each other and from the four/six/wicket
  animations from the previous round.
- **`NowPlaying` panel** — live striker/non-striker/bowler mini-avatars on
  both the Scorer and Live Match Center, driven by the actual last-scored
  delivery from the broadcast (or the WS connect-time snapshot for a
  match already in progress) — **not** by whatever the scorer has
  tentatively picked in the dropdowns but not yet submitted. Verified this
  distinction directly: screenshotted the panel showing the real
  in-progress batters/bowler while the dropdowns below already had
  different, not-yet-submitted players selected.

## Pages added: Squads + Squad Detail

- **Squads** (`/squads`) — list of named player pools per team, "+ New
  Squad" modal (team dropdown + name).
- **Squad Detail** (`/squads/:squadId`) — member list with live
  available/unavailable status dots, add-from-roster dropdown (only shows
  players not already in the squad), inline "Mark unavailable"/"Remove"
  controls, and a **"Generate" XI recommendation panel** that calls the
  existing `XIRecommendationEngine` from Phase 5 — the first UI to
  actually use it. Each recommended pick shows its real reason string from
  the backend ("Top all-rounder — covers both batting depth and bowling
  overs (rating 85.0)"), not a placeholder.
- **Verified the availability filter is functionally correct, not just
  visually plausible**: added 4 players to a squad, generated a
  recommendation (correctly surfaced all three real shortfall warnings —
  no keeper, too few bowling options, squad short of a full XI — rather
  than pretending an 11-player XI existed), then marked the top-rated
  player (85 rating) unavailable and regenerated. Confirmed via
  screenshot: that player dropped out of the recommendation entirely, the
  bowling-options count correctly dropped from 4→3, and the next-best
  player moved up to the top slot — proving the recommendation reads live
  `is_available` state, not a stale/cached roster.

## Admin CRUD + Captain self-onboarding (image uploads, invite links)

Backend additions, all functionally tested before any frontend work:

- **Image upload** — `POST /uploads/image`, validated against
  `Settings.ALLOWED_IMAGE_TYPES`/`MAX_UPLOAD_MB` *before* anything touches
  disk, written under a random UUID filename (never the client-supplied
  name, to avoid path traversal/collisions), served back from `/uploads`.
  **Verified**: real PNG upload succeeds; non-image content-type, oversized
  file, and unauthenticated request are all correctly rejected (400/400/401).
- **`TeamInvite` model** — shareable, single-use, 7-day-expiry token. Admin
  creates one (`POST /teams/{id}/invites`, scoped to their own company);
  the public, *unauthenticated* pair `GET /invites/{token}` +
  `POST /invites/{token}/accept` lets a captain create their own account
  (role=captain, `team_id` pre-scoped to the inviting team) and optionally
  set the team logo in the same step — no admin-created password ever
  gets relayed.
- **Role-scoped writes**: a captain can only add/edit players on their own
  `team_id` and only PATCH their own team (name/logo/coach) — enforced
  server-side, not just hidden in the UI. **Verified** via a full
  functional test: captain correctly blocked (403) from adding a player to
  a different team or editing a different team's coach name.

Frontend additions:

- `ImageUpload` component — file picker with instant local preview,
  uploads via the endpoint above, used for both team logos and player photos.
- **Teams** page: "+ New Team" modal (name, coach, logo upload).
- **Team Detail** page: "+ Add Player" modal (name, role, jersey #, photo)
  and "Invite Captain" modal (generates the link, copy-to-clipboard).
- **`/join/:token`** — standalone public page (deliberately outside the
  main app's sidebar/Layout, like a password-reset page) where a captain
  sets up their account and optional team logo in one form.

**Verified end-to-end with Playwright, not just build-checked**: injected
a real admin JWT into an authenticated browser context, clicked "+ New
Team" and created "Acme Falcons" through the actual UI, added a player to
it, generated a real invite link, then — in a **completely separate,
unauthenticated browser context** (no shared cookies/localStorage) —
opened that exact link, filled the captain signup form, submitted, and
confirmed: redirect to `/teams/4`, a real JWT in the new browser's
localStorage, and in the database — role=`captain`, `team_id=4`,
`company_id=1`, and the invite row marked `used_at`/`used_by_user_id`.
Zero console errors at any step (the only network failure was the
already-documented Google Fonts sandbox restriction).

## Fixed: login was completely missing, and two real bugs found while fixing it

The previous round's "verified end-to-end" test injected an admin JWT
directly into Playwright's `localStorage` — which meant it never actually
exercised the one thing a real user needs: **a way to log in.** There was
no Login page, and the seed script never created a single `User` account.
That's the actual cause of "not authenticated" — not a bug in the modals
themselves, but nothing to authenticate *as*.

Fixed:
- `seed_demo.py` now creates a real Company Admin account and prints the
  credentials (`admin@acme.com` / `admin12345`) at the end of the seed run
- Built `/login` — a real page wired to the actual `/auth/login` endpoint
- Added a global 401 handler (`api/client.ts`) that clears bad tokens and
  redirects to `/login` instead of every page silently failing
- Sidebar now shows real auth state — "Not logged in" + a Log in link, or
  the logged-in user's name/role + Log out — replacing the old
  permanently-on fake "API connected" indicator, which was actively
  misleading
- **The previously-noted role-visibility gap is now fixed**: "+ New Team"
  / "+ Add Player" / "Invite Captain" only render when `useAuth()` confirms
  the logged-in user can actually use them, via a new `canManageTeams` check

**Two more real bugs surfaced while re-verifying this with an actual login
flow (not an injected token) — both caught and fixed in the same pass:**

1. **Duplicate team names crashed with a raw 500 stack trace.** `Team` has
   a `(company_id, name)` uniqueness constraint (working as intended), but
   `create_team` never caught the resulting `IntegrityError` — the client
   got a full SQLAlchemy traceback instead of a clean message. Fixed:
   catches `IntegrityError`, rolls back, returns
   `400 "A team named 'X' already exists in this company."`
2. **Player photos silently never saved.** `PlayerCreate` (the request
   schema for creating a player) never declared a `profile_image_url`
   field — only `PlayerUpdate` did. Pydantic silently drops unrecognized
   fields by default, so the upload succeeded, the frontend sent the URL,
   and the backend just... discarded it. No error anywhere. Caught by
   checking the database directly after a UI test claimed success — the
   photo was in `/uploads/` but never referenced by the player row. Fixed:
   added the missing field to `PlayerCreate`, and while in there, added
   photo avatars (with initial-letter fallback) to the team roster table
   so this is now actually visible instead of invisible-but-technically-there.

**Re-verified the complete chain end-to-end with the real login form**:
unauthenticated visit → confirmed no admin buttons → clicked "Log in" →
real credentials into the real form → redirected → created a team with a
logo upload → added a player with a photo upload → confirmed the photo
now renders as an avatar → generated a captain invite → in a **separate
browser context**, accepted it → captain landed authenticated on their
team page → captain added their own player. Zero console errors across
the entire chain.

## Pages added: Players + Player Detail

- **Players** (`/players`) — searchable grid of every player across every
  team, ranked by overall rating, role-colored badges. **Verified**: all
  15 seeded players rendered correctly ranked (85 down to 13).
- **Player Detail** (`/players/:playerId`) — the richest page yet: profile
  header, 5 core stat tiles, rating breakdown (animated bars per
  component: batting/bowling/fielding/form/consistency/pressure), form
  trend line graph, achievements list with icons, AI insights list.
  **Deliberately handles the case where a player has no computed
  snapshot yet** — most seed-data players never went through a real
  `finalize_match` cascade, so `/analytics/players/{id}/rating` 404s and
  `/form` returns `[]` for them. Rather than crash or show a blank panel,
  each panel has its own explanatory empty state ("Not enough match data
  yet for a rating breakdown", "Needs at least 2 matches to show a form
  trend"). **Verified both states**: Vikram Joshi (went through a real
  finalized match) showed a full rating breakdown (Batting 96, Form 100,
  Pressure 16) and a real achievement (💥 "Hit 3 sixes in an innings");
  Karan Singh (seed-only `current_rating`, no snapshot) correctly showed
  all four empty states instead of breaking.
- Team roster rows now link to the player's detail page.

**Real bug hit and fixed this round**: an `str_replace` edit accidentally
clipped the `export interface PredictionOut {` line while inserting new
interfaces above it, breaking the whole file with a syntax error. Caught
immediately by `npm run build` (`tsc` failed before Vite even tried) —
exactly the kind of mistake a type-checked build step exists to catch.
Also: the frontend's `node_modules` doesn't survive between sessions in
this environment (same as the backend's `.db` file) — every session needs
`npm install` again before `npm run build`/`npm run dev` will work.

## Pages added since the initial frontend pass

- **Teams** (`/teams`) — team cards with live player counts by role
  (batters/bowlers/all-rounders) and average squad rating, computed
  client-side from the same `/players?team_id=` data the roster page uses.
  **Verified**: 3 real teams, correct per-role counts (e.g. Acme Strikers:
  7 players, 2 bowlers, 2 all-rounders, rating 74).
- **Team Detail** (`/teams/:teamId`) — full roster table, sorted by
  rating desc, with role badges (color-coded: amber batter, crimson
  bowler, win-green all-rounder, cream wicketkeeper), runs/average,
  wickets/economy, form, and overall rating per player. **Verified**:
  Acme Strikers' 7-player roster rendered correctly, including proper
  null handling (`—`) for players with no bowling average yet.
- **Tournaments** (`/tournaments`) — tournament switcher + points table
  (P/W/L/T/NRR/Points), amber #1 badge, win-green/crimson NRR coloring.
  **Verified**: Summer Corporate Cup showing Acme Strikers 2 pts
  (+4.833 NRR) vs Acme Titans 0 pts (−4.833 NRR) — correct mirror-image
  NRR for a single 2-team match, correctly sorted.

All three confirmed via Playwright screenshots against the real backend,
same process as the initial pages — no JS console errors on any of them.
