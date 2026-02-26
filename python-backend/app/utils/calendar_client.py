"""Google Calendar API client for meeting density metrics and schedule analysis."""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_calendar_client: "CalendarClient | None" = None

# Google Calendar API base URL
CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"


class CalendarClient:
    """Async client for the Google Calendar API.

    Provides methods to analyze meeting patterns: upcoming/recent meetings,
    meeting density per day, and free time slot discovery.
    """

    def __init__(self, credentials: dict | None = None) -> None:
        self.settings = get_settings()
        self.credentials = credentials
        self.http = httpx.AsyncClient(timeout=30.0)

    def is_configured(self) -> bool:
        """Check whether Calendar credentials have been provided."""
        return self.credentials is not None and bool(self.credentials.get("access_token"))

    def _headers(self) -> dict[str, str]:
        """Return authorization headers for Calendar API requests."""
        token = self.credentials.get("access_token", "") if self.credentials else ""
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

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
            all_events: list[dict] = []
            page_token: str | None = None

            while True:
                params: dict = {
                    "timeMin": time_min,
                    "timeMax": time_max,
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": 250,
                }
                if page_token:
                    params["pageToken"] = page_token

                response = await self.http.get(
                    f"{CALENDAR_API_BASE}/calendars/primary/events",
                    headers=self._headers(),
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                events = data.get("items", [])
                for event in events:
                    # Skip all-day events (no dateTime) for meeting analysis
                    start = event.get("start", {})
                    end = event.get("end", {})
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

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

            return all_events
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Calendar events fetch failed: %s %s",
                exc.response.status_code,
                exc.response.text,
            )
            return []
        except httpx.RequestError:
            logger.exception("Calendar request error")
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

        # Count meetings per day and total hours
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

        # Find busiest day
        busiest_day = meetings_by_day.most_common(1)[0] if meetings_by_day else None

        # Build daily breakdown
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

        Queries the calendar for events on the specified date and returns
        the gaps between meetings during working hours (08:00-18:00).

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

        # Working hours: 08:00 to 18:00
        work_start = target_date.replace(hour=8, minute=0, second=0, tzinfo=timezone.utc)
        work_end = target_date.replace(hour=18, minute=0, second=0, tzinfo=timezone.utc)

        try:
            params = {
                "timeMin": work_start.isoformat(),
                "timeMax": work_end.isoformat(),
                "singleEvents": "true",
                "orderBy": "startTime",
            }

            response = await self.http.get(
                f"{CALENDAR_API_BASE}/calendars/primary/events",
                headers=self._headers(),
                params=params,
            )
            response.raise_for_status()
            data = response.json()

            # Extract busy periods
            busy_periods: list[tuple[datetime, datetime]] = []
            for event in data.get("items", []):
                start = event.get("start", {})
                end = event.get("end", {})
                start_dt_str = start.get("dateTime")
                end_dt_str = end.get("dateTime")
                if not start_dt_str or not end_dt_str:
                    continue

                start_dt = datetime.fromisoformat(start_dt_str)
                end_dt = datetime.fromisoformat(end_dt_str)
                busy_periods.append((start_dt, end_dt))

            # Sort by start time
            busy_periods.sort(key=lambda x: x[0])

            # Find gaps
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

            # Final slot after last meeting
            if current < work_end:
                free_slots.append({
                    "start": current.isoformat(),
                    "end": work_end.isoformat(),
                    "duration_minutes": int((work_end - current).total_seconds() / 60),
                })

            return free_slots
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Calendar free slots fetch failed: %s %s",
                exc.response.status_code,
                exc.response.text,
            )
            return []
        except httpx.RequestError:
            logger.exception("Calendar request error")
            return []


def get_calendar_client() -> CalendarClient:
    """Return a cached singleton CalendarClient instance."""
    global _calendar_client
    if _calendar_client is None:
        _calendar_client = CalendarClient()
    return _calendar_client
