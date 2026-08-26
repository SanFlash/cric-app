"""
Auto-bootstraps the default admin/umpire accounts (and the Company they
belong to) so the app is login-ready with zero manual seeding — this is
what runs automatically on every backend startup, including a fresh
Render deploy.

Idempotent by design: safe to call on every restart, and safe to call
again from seed_demo.py for local rich-demo-data setup — it checks for an
existing admin account by email first and does nothing if one's already
there, so there's no risk of the duplicate-account/duplicate-company class
of bug this project hit earlier when two code paths both tried to create
the same "Acme Corp" company independently.
"""
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.org import Company, User
from app.models.enums import UserRole


def ensure_default_accounts(db: Session) -> tuple[User, User, User]:
    """Returns (admin_user, umpire_user, player_user), creating them (and a
    company for them to belong to) only if they don't already exist."""
    admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    umpire = db.query(User).filter(User.email == settings.DEFAULT_UMPIRE_EMAIL).first()
    player = db.query(User).filter(User.email == settings.DEFAULT_PLAYER_EMAIL).first()
    if admin and umpire and player:
        return admin, umpire, player  # already bootstrapped — nothing to do

    company = db.query(Company).filter(Company.name == settings.DEFAULT_COMPANY_NAME).first()
    if not company:
        company = Company(name=settings.DEFAULT_COMPANY_NAME)
        db.add(company)
        db.flush()

    if not admin:
        admin = User(
            email=settings.DEFAULT_ADMIN_EMAIL,
            hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            full_name=settings.DEFAULT_ADMIN_NAME,
            role=UserRole.COMPANY_ADMIN,
            company_id=company.id,
        )
        db.add(admin)

    if not umpire:
        umpire = User(
            email=settings.DEFAULT_UMPIRE_EMAIL,
            hashed_password=hash_password(settings.DEFAULT_UMPIRE_PASSWORD),
            full_name=settings.DEFAULT_UMPIRE_NAME,
            role=UserRole.UMPIRE,
            company_id=company.id,
        )
        db.add(umpire)

    if not player:
        player = User(
            email=settings.DEFAULT_PLAYER_EMAIL,
            hashed_password=hash_password(settings.DEFAULT_PLAYER_PASSWORD),
            full_name=settings.DEFAULT_PLAYER_NAME,
            role=UserRole.PLAYER,
            company_id=company.id,
        )
        db.add(player)

    db.commit()
    db.refresh(admin)
    db.refresh(umpire)
    db.refresh(player)
    return admin, umpire, player
