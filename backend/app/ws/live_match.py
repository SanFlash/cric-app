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
    """The innings actually in progress for `match_id`, or None if scoring
    hasn't started yet. Both innings rows exist from the moment a match
    starts (so the 2nd innings' target can be set later), so picking simply
    by highest innings_number would show an empty not-yet-started 2nd
    innings while the 1st is still live. Instead: prefer the highest-numbered
    innings that actually has deliveries recorded; only fall back to the
    plain highest-numbered row if nothing has started yet."""
    innings = (
        db.query(Innings)
        .filter(Innings.match_id == match_id, Innings.total_balls > 0)
        .order_by(Innings.innings_number.desc())
        .first()
    )
    if innings is None:
        innings = (
            db.query(Innings)
            .filter(Innings.match_id == match_id)
            .order_by(Innings.innings_number.asc())
            .first()
        )
    if innings is None:
        return None

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
            "striker": _player_brief(last_ball.striker_id) if last_ball else None,
            "non_striker": _player_brief(last_ball.non_striker_id) if last_ball else None,
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
