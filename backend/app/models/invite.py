"""
TeamInvite: a shareable, single-use link that lets an admin hand team setup
off to a captain without creating their account manually. The captain
visits /join/{token}, sets up their own login, and can optionally set the
team logo and start adding players in the same flow — all through the
normal authenticated endpoints once their account exists (Player
create/update already allows the CAPTAIN role; the invite just gets them
an account scoped to the right team_id).
"""
from __future__ import annotations
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


def _generate_token() -> str:
    return secrets.token_urlsafe(24)


def _default_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=7)


class TeamInvite(Base, TimestampMixin):
    __tablename__ = "team_invites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=_generate_token)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_default_expiry)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    team: Mapped["Team"] = relationship(foreign_keys=[team_id])  # noqa: F821

    @property
    def is_valid(self) -> bool:
        now = datetime.now(timezone.utc)
        expires = self.expires_at if self.expires_at.tzinfo else self.expires_at.replace(tzinfo=timezone.utc)
        return self.used_at is None and expires > now
