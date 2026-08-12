"""Date/time helpers. DB stores UTC; responses render in user timezone (default IST)."""

from datetime import date, datetime, time, timedelta, timezone

from app.core.config import settings

IST = timezone(timedelta(hours=5, minutes=30))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ist_now() -> datetime:
    return utc_now().astimezone(IST)


def to_user_tz(dt: datetime, tz_name: str = settings.DEFAULT_TIMEZONE) -> datetime:
    import zoneinfo

    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = IST
    return dt.astimezone(tz)


def month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def period_key(d: date, granularity: str) -> str:
    if granularity == "day":
        return d.isoformat()
    if granularity == "week":
        iso = d.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    if granularity == "year":
        return f"{d.year}"
    return f"{d.year:04d}-{d.month:02d}"


def month_period_from_string(period: str) -> date:
    parts = period.split("-")
    if len(parts) != 2:
        raise ValueError("period must be in YYYY-MM format")
    return date(int(parts[0]), int(parts[1]), 1)
