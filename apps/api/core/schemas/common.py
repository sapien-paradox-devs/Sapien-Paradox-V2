from ninja import Schema


class HealthOut(Schema):
    status: str
    database: str
