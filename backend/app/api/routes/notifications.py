from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.org import User
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str
    is_read: bool
    related_match_id: int | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[NotificationOut])
def list_my_notifications(unread_only: bool = False, limit: int = 50,
                           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return NotificationService(db).list_for_user(user.id, unread_only=unread_only, limit=limit)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = NotificationService(db).mark_read(notification_id, user.id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.commit()
    db.refresh(n)
    return n
