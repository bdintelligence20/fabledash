"""Google Calendar client powered by Composio MCP for meeting density metrics."""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

from app.utils.composio_client import get_composio_client

logger = logging.getLogger(__name__)

_calendar_client: "CalendarClient | None" = None


class CalendarClient:
    """Calendar client that delegates to Composio MCP tools.

    Provides methods to analyze meeting patterns: upcoming/recent meetings,
    meeting density per day, and free time slot discovery.
    """

    def __init__(self) -> None:
        self.composio = get_composio_client()

    def is_configured(self) -> bool:
        """Check whether Composio is configured for Calendar access."""
        return self.composio.is_configured()

    async def get_meetings(
        self, days_ahead: int = 7, days_back: int = 7
    ) -> list[dict]:
        """Fetch calendar events within a date window around today.

        Args:
            days_ahead: Number of days into the future to look.
            days_back: Number of days into the past to look.

        Returns:
            List of event dicts with id, summary, start, end, attendees, and status.
        """
        if not self.is_configured():
            logger.warning("Calendar not configured")
            return []

        now = datetime.now(timezone.utc)
        time_min = (now - timedelta(days=days_back)).isoformat()
        time_max = (now + timedelta(days=days_ahead)).isoformat()

        try:
            result = await self.composio.call_tool("GOOGLECALENDAR_FIND_EVENT", {
                "calendar_id": "primary",
                "time_min": time_min,
                "time_max": time_max,
                "single_events": True,
                "order_by": "startTime",
                "max_results": 250,
            })

            items = result.get("data", {}).get("items", [])
            all_events: list[dict] = []

            for event in items:
                start = event.get("start", {})
                end = event.get("end", {})
                # Skip all-day events for meeting analysis
                if not start.get("dateTime") and not end.get("dateTime"):
                    continue

                attendees = event.get("attendees", [])
                all_events.append({
                    "id": event.get("id"),
                    "summary": event.get("summary", "(no title)"),
                    "start": start.get("dateTime", start.get("date", "")),
                    "end": end.get("dateTime", end.get("date", "")),
                    "status": event.get("status", "confirmed"),
                    "attendees": [
                        {
                            "email": a.get("email", ""),
                            "name": a.get("displayName", ""),
                            "response": a.get("responseStatus", "needsAction"),
                        }
                        for a in attendees
                    ],
                    "attendee_count": len(attendees),
                    "location": event.get("location", ""),
                    "hangout_link": event.get("hangoutLink", ""),
                })

            return all_events
        except Exception:
            logger.exception("Calendar events fetch failed via Composio")
            return []

    async def get_meeting_density(self, days: int = 30) -> dict:
        """Calculate meeting density metrics over a period.

        Args:
            days: Number of days to analyze.

        Returns:
            Dict with meetings_per_day average, total_meetings, busiest_day,
            meeting_hours total, and daily breakdown.
        """
        if not self.is_configured():
            return {"configured": False}

        meetings = await self.get_meetings(days_ahead=0, days_back=days)

        if not meetings:
            return {
                "configured": True,
                "period_days": days,
                "total_meetings": 0,
                "meetings_per_day": 0.0,
                "total_meeting_hours": 0.0,
                "busiest_day": None,
                "daily_breakdown": [],
            }

        meetings_by_day: Counter = Counter()
        total_hours = 0.0

        for meeting in meetings:
            try:
                start_str = meeting.get("start", "")
                end_str = meeting.get("end", "")
                if not start_str or not end_str:
                    continue

                start_dt = datetime.fromisoformat(start_str)
                end_dt = datetime.fromisoformat(end_str)

                day_key = start_dt.strftime("%Y-%m-%d")
                meetings_by_day[day_key] += 1

                duration_hours = (end_dt - start_dt).total_seconds() / 3600
                total_hours += max(0, duration_hours)
            except (ValueError, TypeError):
                continue

        total_meetings = len(meetings)
        meetings_per_day = total_meetings / max(days, 1)

        busiest_day = meetings_by_day.most_common(1)[0] if meetings_by_day else None

        now = datetime.now(timezone.utc)
        daily_breakdown: list[dict] = []
        for i in range(days):
            day = (now - timedelta(days=days - i - 1)).strftime("%Y-%m-%d")
            count = meetings_by_day.get(day, 0)
            daily_breakdown.append({"date": day, "meetings": count})

        return {
            "configured": True,
            "period_days": days,
            "total_meetings": total_meetings,
            "meetings_per_day": round(meetings_per_day, 2),
            "total_meeting_hours": round(total_hours, 1),
            "busiest_day": {
                "date": busiest_day[0],
                "meetings": busiest_day[1],
            }
            if busiest_day
            else None,
            "daily_breakdown": daily_breakdown,
        }

    async def get_free_slots(self, date: str) -> list[dict]:
        """Find available time slots on a given date.

        Args:
            date: Date string in YYYY-MM-DD format.

        Returns:
            List of dicts with start and end times of free slots.
        """
        if not self.is_configured():
            return []

        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            logger.error("Invalid date format: %s (expected YYYY-MM-DD)", date)
            return []

        work_start = target_date.replace(hour=8, minute=0, second=0, tzinfo=timezone.utc)
        work_end = target_date.replace(hour=18, minute=0, second=0, tzinfo=timezone.utc)

        try:
            result = await self.composio.call_tool("GOOGLECALENDAR_FIND_EVENT", {
                "calendar_id": "primary",
                "time_min": work_start.isoformat(),
                "time_max": work_end.isoformat(),
                "single_events": True,
                "order_by": "startTime",
            })

            items = result.get("data", {}).get("items", [])

            busy_periods: list[tuple[datetime, datetime]] = []
            for event in items:
                start = event.get("start", {})
                end = event.get("end", {})
                start_dt_str = start.get("dateTime")
                end_dt_str = end.get("dateTime")
                if not start_dt_str or not end_dt_str:
                    continue
                busy_periods.append((
                    datetime.fromisoformat(start_dt_str),
                    datetime.fromisoformat(end_dt_str),
                ))

            busy_periods.sort(key=lambda x: x[0])

            free_slots: list[dict] = []
            current = work_start

            for busy_start, busy_end in busy_periods:
                if current < busy_start:
                    free_slots.append({
                        "start": current.isoformat(),
                        "end": busy_start.isoformat(),
                        "duration_minutes": int((busy_start - current).total_seconds() / 60),
                    })
                current = max(current, busy_end)

            if current < work_end:
                free_slots.append({
                    "start": current.isoformat(),
                    "end": work_end.isoformat(),
                    "duration_minutes": int((work_end - current).total_seconds() / 60),
                })

            return free_slots
        except Exception:
            logger.exception("Calendar free slots fetch failed via Composio")
            return []


def get_calendar_client() -> CalendarClient:
    """Return a cached singleton CalendarClient instance."""
    global _calendar_client
    if _calendar_client is None:
        _calendar_client = CalendarClient()
    return _calendar_client
