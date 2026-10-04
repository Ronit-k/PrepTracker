"""Application dates always follow India, regardless of host timezone."""
from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo('Asia/Kolkata')


def now_ist():
    return datetime.now(IST)


def today_ist():
    return now_ist().date()
