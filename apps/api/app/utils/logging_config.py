import logging
import re
import sys

from app.utils.json_logging import JsonLogFormatter
from app.utils.request_context import get_request_id

_SENSITIVE_PATTERNS = (
    re.compile(r"(password|secret|token|authorization|api[_-]?key)\s*[=:]\s*\S+", re.I),
    re.compile(r"Bearer\s+\S+", re.I),
)


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            redacted = record.msg
            for pattern in _SENSITIVE_PATTERNS:
                redacted = pattern.sub(lambda m: m.group().split("=")[0] + "=***", redacted)
            record.msg = redacted
        return True


class RequestIdLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def setup_logging(*, debug: bool = False, json_logs: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RedactSecretsFilter())
    handler.addFilter(RequestIdLogFilter())

    if json_logs:
        handler.setFormatter(JsonLogFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(request_id)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )

    logging.basicConfig(level=level, handlers=[handler], force=True)
