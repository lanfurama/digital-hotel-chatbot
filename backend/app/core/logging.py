"""
Structured JSON logging cho production.
Ghi file với daily rotation. Development dùng console format.
"""
import json
import logging
import logging.handlers
import sys
from datetime import datetime, timezone
from pathlib import Path


class JSONFormatter(logging.Formatter):
    """Format log record thành một dòng JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_obj["exc"] = self.formatException(record.exc_info)
        # Cho phép thêm extra fields
        for key, val in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            ):
                log_obj[key] = val
        return json.dumps(log_obj, ensure_ascii=False, default=str)


def setup_logging(app_env: str = "development", log_dir: str = "logs") -> None:
    """Cấu hình logging theo môi trường."""
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Xóa handlers cũ
    root.handlers.clear()

    if app_env == "production":
        # JSON logs → file với daily rotation
        Path(log_dir).mkdir(parents=True, exist_ok=True)
        handler = logging.handlers.TimedRotatingFileHandler(
            filename=f"{log_dir}/app.log",
            when="midnight",
            backupCount=30,
            encoding="utf-8",
        )
        handler.setFormatter(JSONFormatter())
        root.addHandler(handler)

        # Errors cũng ghi ra stderr cho Docker log collector
        err_handler = logging.StreamHandler(sys.stderr)
        err_handler.setLevel(logging.ERROR)
        err_handler.setFormatter(JSONFormatter())
        root.addHandler(err_handler)
    else:
        # Development: readable console output
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%H:%M:%S",
            )
        )
        root.addHandler(handler)

    # Giảm noise từ thư viện
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
