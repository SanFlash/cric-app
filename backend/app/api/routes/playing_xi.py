from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import require_roles
from app.models.org import Player
from app.models.match import Match, PlayingXI
from app.models.enums import UserRole
from app.schemas.squad import PlayingXISelect, PlayingXIOut, BattingOrderReorder
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/playing-xi", tags=["playing-xi"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.CAPTAIN)


@router.get("", response_model=list[PlayingXIOut])
def get_playing_xi(match_id: int, team_id: int, db: Session = Depends(get_db)):
    return (
        db.query(PlayingXI)
        .filter(PlayingXI.match_id == match_id, PlayingXI.team_id == team_id)
        .order_by(PlayingXI.is_substitute, PlayingXI.batting_order)
        .all()
    )


@router.put("", response_model=list[PlayingXIOut], dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def select_playing_xi(payload: PlayingXISelect, db: Session = Depends(get_db)):
    """
    Replaces the full XI + substitutes for (match_id, team_id) atomically —
    the natural shape for a squad-selection screen where the captain picks/
    re-picks the whole team at once rather than adding players one at a time.
    """
    match = db.get(Match, payload.match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if payload.team_id not in (match.team_a_id, match.team_b_id):
        raise HTTPException(status_code=400, detail="Team is not part of this match")
    if len(payload.player_ids) != 11:
        raise HTTPException(status_code=400, detail="Playing XI must contain exactly 11 players")
    if len(set(payload.player_ids)) != 11:
        raise HTTPException(status_code=400, detail="Playing XI contains duplicate players")
    if payload.wicketkeeper_id not in payload.player_ids:
        raise HTTPException(status_code=400, detail="Wicketkeeper must be part of the selected XI")
    if payload.captain_id not in payload.player_ids:
        raise HTTPException(status_code=400, detail="Captain must be part of the selected XI")
    overlap = set(payload.player_ids) & set(payload.substitute_ids)
    if overlap:
        raise HTTPException(status_code=400, detail="A player cannot be both in the XI and a substitute")

    all_ids = payload.player_ids + payload.substitute_ids
    found = db.query(Player.id).filter(Player.id.in_(all_ids), Player.is_deleted.is_(False)).all()
    if len(found) != len(set(all_ids)):
        raise HTTPException(status_code=404, detail="One or more players not found")

    # Atomic replace: wipe any prior selection for this match+team, then insert fresh
    db.query(PlayingXI).filter(PlayingXI.match_id == payload.match_id, PlayingXI.team_id == payload.team_id).delete()
    db.flush()

    rows: list[PlayingXI] = []
    for order, player_id in enumerate(payload.player_ids, start=1):
        rows.append(PlayingXI(
            match_id=payload.match_id, team_id=payload.team_id, player_id=player_id,
            batting_order=order, is_substitute=False,
            is_wicketkeeper=(player_id == payload.wicketkeeper_id),
            is_captain=(player_id == payload.captain_id),
            is_vice_captain=(player_id == payload.vice_captain_id),
        ))
    for player_id in payload.substitute_ids:
        rows.append(PlayingXI(
            match_id=payload.match_id, team_id=payload.team_id, player_id=player_id,
            batting_order=None, is_substitute=True,
        ))
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)

    # Section 23: "Player selected" notification for everyone in the confirmed XI.
    NotificationService(db).notify_squad_selection(payload.match_id, payload.player_ids)
    db.commit()

    return rows


@router.patch(
    "/batting-order", response_model=list[PlayingXIOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def reorder_batting_order(payload: BattingOrderReorder, db: Session = Depends(get_db)):
    """Drag-and-drop reorder (section 6): pass the full XI's player_ids in
    the new order; positions are reassigned 1..N. Substitutes are untouched."""
    xi_rows = {
        r.player_id: r for r in
        db.query(PlayingXI).filter(
            PlayingXI.match_id == payload.match_id,
            PlayingXI.team_id == payload.team_id,
            PlayingXI.is_substitute.is_(False),
        ).all()
    }
    if set(payload.ordered_player_ids) != set(xi_rows.keys()):
        raise HTTPException(status_code=400, detail="Reorder list must contain exactly the current XI's players")

    for position, player_id in enumerate(payload.ordered_player_ids, start=1):
        xi_rows[player_id].batting_order = position
    db.commit()
    return sorted(xi_rows.values(), key=lambda r: r.batting_order)
