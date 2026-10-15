import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Notification, User

logger = logging.getLogger("ayursutra.notifications")


class NotificationService:
    """
    Handles in-app notification persistence and mock SMS / Email gateway dispatch.
    """

    @staticmethod
    def send_notification(
        db: Session,
        user_id: str,
        title: str,
        body: str,
        channel: str = "in_app",  # "in_app", "sms", "email", "all"
    ) -> Notification:
        # 1. Create in-app notification record
        notif = Notification(
            user_id=user_id,
            title=title,
            body=body,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        user = db.query(User).filter(User.id == user_id).first()
        recipient_info = f"{user.email}" if user else f"User ID {user_id}"
        phone_info = f" (+91 {user.phone})" if user and user.phone else ""

        # 2. Simulated external dispatch
        if channel in ("sms", "all"):
            logger.info(
                f"[MOCK SMS GATEWAY] To: {recipient_info}{phone_info} | Content: {title} - {body}"
            )
            print(
                f"\n📲 [MOCK SMS DISPATCHED] -> {recipient_info}{phone_info}\n   Header: {title}\n   Message: {body}\n"
            )

        if channel in ("email", "all"):
            logger.info(
                f"[MOCK EMAIL GATEWAY] To: {recipient_info} | Subject: {title} | Body: {body}"
            )
            print(
                f"\n📧 [MOCK EMAIL DISPATCHED] -> {recipient_info}\n   Subject: {title}\n   Body: {body}\n"
            )

        return notif


notification_service = NotificationService()
