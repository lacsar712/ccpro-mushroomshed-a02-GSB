from datetime import datetime

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


def find_active_rest_window(db, room_id: int, at: datetime):
    """返回该出菇室在 at 时刻生效的休整窗（无则 None）。

    半开区间 [start_at, end_at)：结束当刻即视为休整结束。
    """
    return (
        db.query(RestWindow)
        .filter(
            RestWindow.room_id == room_id,
            RestWindow.start_at <= at,
            RestWindow.end_at > at,
        )
        .order_by(RestWindow.end_at.desc())
        .first()
    )
