"""
NotificationService (section 23). Thin wrapper around Notification rows —
each `notify_*` method is called from the natural trigger point in another
service (ScoringService/StatisticsEngine/AchievementEngine/playing_xi
routes) rather than polled, so notifications appear the instant the
triggering event actually happens.

Only creates a notification when the target Player has a linked User
account (`Player.user_id`) — a player without a login has nowhere to
receive it, so silently skipping is correct, not a bug to fix.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.org import Player
from app.models.match import Match
from app.models.performance import Notification
from app.services.achievement_engine import AwardedAchievement


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def _create(self, user_id: int, type_: str, title: str, body: str, related_match_id: int | None = None) -> Notification:
        n = Notification(user_id=user_id, type=type_, title=title, body=body, related_match_id=related_match_id)
        self.db.add(n)
        self.db.flush()
        return n

    def notify_achievement(self, player_id: int, match_id: int, achievement: AwardedAchievement) -> Notification | None:
        player: Player = self.db.get(Player, player_id)
        if not player or not player.user_id:
            return None
        first_name = player.full_name.split(" ")[0]
        return self._create(
            player.user_id, "achievement",
            title=f"Achievement unlocked: {achievement.label}",
            body=f"Congratulations {first_name}! {achievement.label}.",
            related_match_id=match_id,
        )

    def notify_match_result(self, match_id: int) -> list[Notification]:
        """Notifies every player (with a linked account) on both teams once a match completes."""
        match: Match = self.db.get(Match, match_id)
        if not match or not match.result_summary:
            return []
        players = (
            self.db.query(Player)
            .filter(Player.team_id.in_([match.team_a_id, match.team_b_id]), Player.user_id.isnot(None))
            .all()
        )
        created = []
        for p in players:
            created.append(self._create(
                p.user_id, "match_result",
                title="Match result",
                body=match.result_summary,
                related_match_id=match_id,
            ))
        return created

    def notify_squad_selection(self, match_id: int, player_ids: list[int]) -> list[Notification]:
        """Section 23: 'Player selected' notification when a Playing XI is confirmed."""
        players = self.db.query(Player).filter(Player.id.in_(player_ids), Player.user_id.isnot(None)).all()
        match: Match = self.db.get(Match, match_id)
        created = []
        for p in players:
            created.append(self._create(
                p.user_id, "squad_selection",
                title="You've been selected",
                body=f"You've been selected in the Playing XI for the match on "
                     f"{match.scheduled_at.strftime('%Y-%m-%d %H:%M')}." if match else "You've been selected in the Playing XI.",
                related_match_id=match_id,
            ))
        return created

    def notify_unavailable_marked(self, player_id: int, squad_id: int) -> Notification | None:
        """Informational note to the player's own account confirming their availability update landed."""
        player: Player = self.db.get(Player, player_id)
        if not player or not player.user_id:
            return None
        return self._create(
            player.user_id, "availability",
            title="Availability updated",
            body="Your availability status has been updated for the squad.",
        )

    def mark_read(self, notification_id: int, user_id: int) -> Notification | None:
        n = self.db.get(Notification, notification_id)
        if not n or n.user_id != user_id:
            return None
        n.is_read = True
        self.db.flush()
        return n

    def list_for_user(self, user_id: int, unread_only: bool = False, limit: int = 50) -> list[Notification]:
        q = self.db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            q = q.filter(Notification.is_read.is_(False))
        return q.order_by(Notification.created_at.desc()).limit(limit).all()
