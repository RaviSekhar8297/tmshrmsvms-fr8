from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import NotificationLog, User
from routes.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
def get_notifications(
    unread_only: bool = False,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(NotificationLog).filter(NotificationLog.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(NotificationLog.is_read == False)
    
    notifications = query.order_by(NotificationLog.sent_at.desc()).limit(limit).all()
    
    return notifications

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = db.query(NotificationLog).filter(
        NotificationLog.user_id == current_user.id,
        NotificationLog.is_read == False
    ).count()
    
    return {"unread_count": count}

@router.put("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(NotificationLog).filter(
        NotificationLog.id == notification_id,
        NotificationLog.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    db.commit()
    
    return {"message": "Notification marked as read"}

@router.put("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(NotificationLog).filter(
        NotificationLog.user_id == current_user.id,
        NotificationLog.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(NotificationLog).filter(
        NotificationLog.id == notification_id,
        NotificationLog.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}






