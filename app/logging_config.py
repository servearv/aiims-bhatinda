import logging
import sys
import os
from pythonjsonlogger import jsonlogger
from flask import g, request

class AppFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        # Handle cases where we log outside request contexts
        try:
            log_record['request_id'] = getattr(g, 'request_id', '-')
        except Exception:
            log_record['request_id'] = '-'
        log_record['service'] = 'aiims-bathinda'

def configure_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(AppFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    loki_url = os.environ.get("LOKI_URL")
    if loki_url:
        import logging_loki
        loki_handler = logging_loki.LokiHandler(
            url=loki_url, 
            tags={"application": "aiims-bathinda-flask"},
            version="1",
        )
        loki_handler.setFormatter(AppFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(loki_handler)
