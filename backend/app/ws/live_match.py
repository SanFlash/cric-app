"""
Live Match Center (section 9). One WS connection room per match_id; every
client in the room receives the same broadcast. ConnectionManager is process-
local — for multi-instance deployment, swap the in-memory dict for a Redis
pub/sub channel (broadcast() is the only method that needs to change).
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.match import Innings, Delivery
from app.models.org import Player
from app.services.scoring_service import current_batters_after

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[int, list[WebSocket]] = {}

    async def connect(self, match_id: int, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(match_id, []).append(ws)

    def disconnect(self, match_id: int, ws: WebSocket):
        if match_id in self.rooms and ws in self.rooms[match_id]:
            self.rooms[match_id].remove(ws)
            if not self.rooms[match_id]:
                del self.rooms[match_id]

    async def broadcast(self, match_id: int, payload: dict):
        for ws in self.rooms.get(match_id, []):
            await ws.send_json(payload)


manager = ConnectionManager()


def _current_snapshot(db: Session, match_id: int) -> dict | None:
    """The innings actually in progress for `match_id`, or None if the
    match has no innings rows at all. Both innings rows exist from the
    moment a match starts (so the 2nd innings' target can be set later),
    so this needs to correctly distinguish three states, in priority
    order:
    1. An innings that's actively being scored (not completed, has
       balls) — the normal mid-innings case.
    2. An innings that hasn't been completed yet, even with zero balls —
       this is what makes the transition into a new innings work. The
       previous version of this function only handled "some innings has
       balls" vs "nothing has started anywhere," and had no case for
       "the one with balls is now COMPLETE, move to the next one" — so
       once innings 1 finished, this kept reporting innings 1 forever,
       and the 2nd innings could never be scored at all (its snapshot
       showed innings 1's stale, completed state indefinitely, since
       nothing about a fresh 0-ball innings 2 ever satisfied the old
       `total_balls > 0` filter).
    3. Fallback: the last innings by number, for a fully-completed match
       or any other edge case.
    Mirrors the equivalent picking logic on the frontend (Scorer.tsx's
    `load()`) so both agree on which innings is "current."
    """
    all_innings = (
        db.query(Innings)
        .filter(Innings.match_id == match_id)
        .order_by(Innings.innings_number.asc())
        .all()
    )
    if not all_innings:
        return None

    innings = next((i for i in all_innings if not i.is_completed and i.total_balls > 0), None)
    if innings is None:
        innings = next((i for i in all_innings if not i.is_completed), None)
    if innings is None:
        innings = all_innings[-1]

    def _player_brief(player_id: int | None) -> dict | None:
        if player_id is None:
            return None
        p = db.get(Player, player_id)
        if not p:
            return None
        return {"id": p.id, "full_name": p.full_name, "profile_image_url": p.profile_image_url}

    last_ball = (
        db.query(Delivery)
        .filter(Delivery.innings_id == innings.id, Delivery.is_corrected.is_(False))
        .order_by(Delivery.sequence_no.desc())
        .first()
    )
    # Who's ACTUALLY on strike for the next ball — not just who batted the
    # last one — accounting for odd-run/end-of-over rotation. Otherwise a
    # reconnect/reopen restores the wrong batter as striker.
    current_striker_id, current_non_striker_id = current_batters_after(last_ball)

    return {
        "type": "scoreboard_snapshot",
        "match_id": match_id,
        "innings_id": innings.id,
        "innings_number": innings.innings_number,
        "score": f"{innings.total_runs}/{innings.total_wickets}",
        "overs": innings.overs_display,
        "run_rate": innings.run_rate,
        "target": innings.target,
        "is_completed": innings.is_completed,
        # So a viewer who joins mid-match sees who's at the crease immediately,
        # not just after the next ball is bowled.
        "current_players": {
            "striker": _player_brief(current_striker_id),
            "non_striker": _player_brief(current_non_striker_id),
            "bowler": _player_brief(last_ball.bowler_id) if last_ball else None,
        } if last_ball else None,
    }


@router.websocket("/ws/matches/{match_id}")
async def live_match_socket(websocket: WebSocket, match_id: int, db: Session = Depends(get_db)):
    await manager.connect(match_id, websocket)
    snapshot = _current_snapshot(db, match_id)
    if snapshot:
        await websocket.send_json(snapshot)
    try:
        while True:
            # Clients don't need to send anything; this just keeps the socket
            # alive and lets us detect disconnects. Extend here if you want
            # clients to request a specific view (e.g. "commentary_only").
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(match_id, websocket)
