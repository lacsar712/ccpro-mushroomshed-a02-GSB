from marshmallow import Schema, fields, validates_schema, validate, ValidationError


REST_INTENSITIES = ("mild", "strict")


class RestWindowCreateSchema(Schema):
    room_id = fields.Int(required=True, data_key="roomId")
    start_at = fields.DateTime(required=True, data_key="startAt")
    end_at = fields.DateTime(required=True, data_key="endAt")
    intensity = fields.Str(required=True, validate=validate.OneOf(REST_INTENSITIES))
    note = fields.Str(allow_none=True, validate=validate.Length(max=1000))

    @validates_schema
    def validate_range(self, data, **kwargs):
        if data.get("start_at") and data.get("end_at") and data["end_at"] <= data["start_at"]:
            raise ValidationError("endAt 必须晚于 startAt")


class RestWindowOutSchema(Schema):
    id = fields.Int(dump_only=True)
    room_id = fields.Int(data_key="roomId")
    start_at = fields.DateTime(data_key="startAt")
    end_at = fields.DateTime(data_key="endAt")
    intensity = fields.Str()
    note = fields.Str(allow_none=True)
