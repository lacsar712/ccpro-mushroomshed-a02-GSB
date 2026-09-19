from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.database import SessionLocal
from app.models.rest_window import RestWindow
from app.models.room import Room
from app.schemas.rest_window import RestWindowCreateSchema, RestWindowOutSchema
from app.utils import find_overlapping_window, validation_error_response

bp = Blueprint("rest_windows", __name__, url_prefix="/api/rest-windows")

create_schema = RestWindowCreateSchema()
out_schema = RestWindowOutSchema()
out_many = RestWindowOutSchema(many=True)


@bp.get("")
@jwt_required()
def list_rest_windows():
    db = SessionLocal()
    try:
        q = db.query(RestWindow)
        room_id = request.args.get("roomId", type=int)
        if room_id is not None:
            q = q.filter(RestWindow.room_id == room_id)
        rows = q.order_by(RestWindow.start_at.desc()).all()
        return jsonify(out_many.dump(rows))
    finally:
        db.close()


@bp.post("")
@jwt_required()
def create_rest_window():
    db = SessionLocal()
    try:
        try:
            data = create_schema.load(request.get_json(silent=True) or {})
        except ValidationError as err:
            return validation_error_response(err)

        room = db.query(Room).filter(Room.id == data["room_id"]).first()
        if not room:
            return jsonify({"detail": "出菇室不存在"}), 400
        if room.status == "idle":
            return jsonify({"detail": "idle 状态的出菇室禁止开设休整窗"}), 409

        overlap = find_overlapping_window(
            db, data["room_id"], data["start_at"], data["end_at"]
        )
        if overlap:
            return (
                jsonify(
                    {
                        "detail": (
                            f"与休整窗 #{overlap.id} 时间相交（{overlap.intensity}，"
                            f"{overlap.start_at:%Y-%m-%d %H:%M} ~ {overlap.end_at:%Y-%m-%d %H:%M}）"
                        )
                    }
                ),
                409,
            )

        item = RestWindow(
            room_id=data["room_id"],
            start_at=data["start_at"],
            end_at=data["end_at"],
            intensity=data["intensity"],
            note=data.get("note"),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return jsonify(out_schema.dump(item)), 201
    finally:
        db.close()


@bp.delete("/<int:window_id>")
@jwt_required()
def delete_rest_window(window_id: int):
    db = SessionLocal()
    try:
        item = db.query(RestWindow).filter(RestWindow.id == window_id).first()
        if not item:
            return jsonify({"detail": "休整窗不存在"}), 404
        db.delete(item)
        db.commit()
        return "", 204
    finally:
        db.close()
