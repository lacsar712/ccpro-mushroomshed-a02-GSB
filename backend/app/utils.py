from datetime import datetime, timezone
from typing import List, Optional

from flask import jsonify
from marshmallow import ValidationError

from app.models.rest_window import RestWindow


def validation_error_response(err: ValidationError):
    messages = []
    for field, msgs in err.messages.items():
        if isinstance(msgs, list):
            for m in msgs:
                messages.append(f"{field}: {m}" if field != "_schema" else str(m))
        else:
            messages.append(f"{field}: {msgs}")
    detail = "; ".join(messages) if messages else "请求参数校验失败"
    return jsonify({"detail": detail}), 400


def as_utc(dt: datetime) -> datetime:
    """Normalize datetimes for window comparisons (MySQL stores naive UTC)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def rest_windows_for(db, room_id: int) -> List[RestWindow]:
    return (
        db.query(RestWindow)
        .filter(RestWindow.room_id == room_id)
        .order_by(RestWindow.start_at)
        .all()
    )


def find_overlapping_window(
    db, room_id: int, start_at: datetime, end_at: datetime
) -> Optional[RestWindow]:
    """Return a same-room window whose [start, end) overlaps [start_at, end_at)."""
    start_at = as_utc(start_at)
    end_at = as_utc(end_at)
    for win in rest_windows_for(db, room_id):
        win_start = as_utc(win.start_at)
        win_end = as_utc(win.end_at)
        if start_at < win_end and end_at > win_start:
            return win
    return None


def active_rest_window(db, room_id: int, at: datetime) -> Optional[RestWindow]:
    """Return the window covering `at` (strict wins over mild)."""
    at = as_utc(at)
    mild: Optional[RestWindow] = None
    for win in rest_windows_for(db, room_id):
        if as_utc(win.start_at) <= at < as_utc(win.end_at):
            if win.intensity == "strict":
                return win
            mild = win
    return mild
