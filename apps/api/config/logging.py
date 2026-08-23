"""Structured JSON logging to stdout (D22).

No log vendor. JSON costs nothing now and makes shipping to a service later a config
change rather than a reformatting exercise.

HARD RULE, held by convention rather than by code: never log a grant token, a reset
token, or a full /r/:token URL. Log the grant's id. Logs are less protected than the
database — visible in a host dashboard, readable by anyone with deploy access.
"""

import json
import logging

_RESERVED = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__.keys()
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
        }

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # Anything passed as logger.info("...", extra={"grant_id": 12}) rides along.
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, default=str)
