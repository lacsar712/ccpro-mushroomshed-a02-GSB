from datetime import timezone

from marshmallow import Schema, fields, validates_schema, validate, ValidationError


REST_INTENSITIES = ("mild", "strict")


class RestWindowCreateSchema(Schema):
    room_id = fields.Int(required=True, data_key="roomId")
    start_at = fields.DateTime(required=True, data_key="startAt")
    end_at = fields.DateTime(required=True, data_key="endAt")
    intensity = fields.Str(required=True, validate=validate.OneOf(REST_INTENSITIES))
    note = fields.Str(required=False, allow_none=True, validate=validate.Length(max=500))

    @validates_schema
    def validate_range(self, data, **kwargs):
        start = data.get("start_at")
        end = data.get("end_at")
        if start and end:
            # 混用带时区/不带时区时间时，把 naive 视作 UTC，保证可比
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            if end <= start:
                raise ValidationError({"endAt": ["endAt 必须晚于 startAt"]})


class RestWindowOutSchema(Schema):
    id = fields.Int(dump_only=True)
    room_id = fields.Int(data_key="roomId")
    start_at = fields.DateTime(data_key="startAt")
    end_at = fields.DateTime(data_key="endAt")
    intensity = fields.Str()
    note = fields.Str(allow_none=True)
