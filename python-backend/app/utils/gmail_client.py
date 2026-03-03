"""Gmail client powered by Composio MCP for communication pattern analysis."""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

from app.utils.composio_client import get_composio_client

logger = logging.getLogger(__name__)

_gmail_client: "GmailClient | None" = None


def _str(val, default: str = "") -> str:
    """Safely coerce a Composio field value to a plain string.

    Composio sometimes returns structured objects (e.g. {"subject": "...", "body": "..."})
    instead of plain strings. This helper extracts the most useful string value.
    """
    if val is None:
        return default
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        # Try common text keys in priority order
        for key in ("subject", "body", "text", "content", "value", "snippet", "preview"):
            v = val.get(key)
            if isinstance(v, str) and v:
                return v
        return default
    if isinstance(val, (int, float)):
        return str(val)
    return default


class GmailClient:
    """Gmail client that delegates to Composio MCP tools.

    Provides methods to analyze communication patterns: email volume trends,
    top correspondents, and per-client email history.
    """

    def __init__(self) -> None:
        self.composio = get_composio_client()

    def is_configured(self) -> bool:
        """Check whether Composio is configured for Gmail access."""
        return self.composio.is_configured()

    @staticmethod
    def _extract_messages(result: dict | str | list) -> list[dict]:
        """Safely extract messages list from a Composio tool result.

        Handles multiple Composio response shapes:
          {"data": {"messages": [...]}}   — nested
          {"messages": [...]}             — flat dict
          {"data": [...]}                 — data is the list
          [...]                           — bare list
        """
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            data = result.get("data", {})
            # nested: {"data": {"messages": [...]}}
            if isinstance(data, dict):
                for key in ("messages", "emails", "items", "results"):
                    val = data.get(key)
                    if isinstance(val, list):
                        return val
            # data IS the list
            if isinstance(data, list):
                return data
            # flat: {"messages": [...]}
            for key in ("messages", "emails", "items", "results"):
                val = result.get(key)
                if isinstance(val, list):
                    return val
        logger.debug("_extract_messages: unrecognised shape: %s", type(result))
        return []

    async def get_email_stats(self, days: int = 30) -> dict:
        """Count emails sent and received, identify top correspondents.

        Args:
            days: Number of days to look back.

        Returns:
            Dict with sent_count, received_count, and top_correspondents.
        """
        if not self.is_configured():
            return {"configured": False}

        since = datetime.now(timezone.utc) - timedelta(days=days)
        date_str = since.strftime("%Y/%m/%d")

        try:
            # Fetch sent emails
            sent_result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"in:sent after:{date_str}",
                "max_results": 100,
            })
            sent_msgs = self._extract_messages(sent_result)

            # Fetch received emails
            recv_result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"in:inbox after:{date_str}",
                "max_results": 100,
            })
            recv_msgs = self._extract_messages(recv_result)

            # Count correspondents from the enriched message data
            correspondent_counter: Counter = Counter()

            for msg in sent_msgs[:100]:
                to_addr = _str(msg.get("to"))
                if to_addr:
                    addr = to_addr.split("<")[-1].rstrip(">").strip()
                    if addr:
                        correspondent_counter[addr] += 1

            for msg in recv_msgs[:100]:
                from_addr = _str(msg.get("sender"))
                if from_addr:
                    addr = from_addr.split("<")[-1].rstrip(">").strip()
                    if addr:
                        correspondent_counter[addr] += 1

            top_correspondents = [
                {"email": email, "count": count}
                for email, count in correspondent_counter.most_common(10)
            ]

            return {
                "configured": True,
                "period_days": days,
                "sent_count": len(sent_msgs),
                "received_count": len(recv_msgs),
                "total_count": len(sent_msgs) + len(recv_msgs),
                "top_correspondents": top_correspondents,
            }
        except Exception:
            logger.exception("Failed to get email stats via Composio")
            return {"configured": True, "error": "Failed to fetch email stats"}

    async def get_client_emails(self, client_email: str, days: int = 30) -> list[dict]:
        """Fetch emails exchanged with a specific client email address.

        Args:
            client_email: The client's email address.
            days: Number of days to look back.

        Returns:
            List of email dicts with subject, date, direction, and snippet.
        """
        if not self.is_configured():
            return []

        since = datetime.now(timezone.utc) - timedelta(days=days)
        date_str = since.strftime("%Y/%m/%d")

        try:
            result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"from:{client_email} OR to:{client_email} after:{date_str}",
                "max_results": 100,
            })
            messages = self._extract_messages(result)

            emails: list[dict] = []
            for msg in messages:
                from_addr = _str(msg.get("sender")).lower()
                direction = "received" if client_email.lower() in from_addr else "sent"

                emails.append({
                    "id": _str(msg.get("messageId")),
                    "subject": _str(msg.get("subject"), "(no subject)"),
                    "date": msg.get("messageTimestamp", ""),
                    "direction": direction,
                    "snippet": _str(msg.get("preview")),
                })

            return emails
        except Exception:
            logger.exception("Failed to get client emails via Composio")
            return []

    async def get_recent_emails(self, days: int = 30, max_results: int = 15) -> list[dict]:
        """Fetch the most recent emails (sent + received), sorted by date desc.

        Args:
            days: Number of days to look back.
            max_results: Maximum total emails to return.

        Returns:
            List of email dicts with id, subject, date, direction, from_addr, snippet.
        """
        if not self.is_configured():
            return []

        since = datetime.now(timezone.utc) - timedelta(days=days)
        date_str = since.strftime("%Y/%m/%d")

        try:
            sent_result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"in:sent after:{date_str}",
                "max_results": max_results,
            })
            recv_result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"in:inbox after:{date_str}",
                "max_results": max_results,
            })
            sent_msgs = self._extract_messages(sent_result)
            recv_msgs = self._extract_messages(recv_result)

            emails: list[dict] = []
            for msg in sent_msgs:
                emails.append({
                    "id": _str(msg.get("messageId")),
                    "subject": _str(msg.get("subject"), "(no subject)"),
                    "date": msg.get("messageTimestamp", ""),
                    "direction": "sent",
                    "from_addr": _str(msg.get("sender")),
                    "to_addr": _str(msg.get("to")),
                    "snippet": _str(msg.get("preview")),
                })
            for msg in recv_msgs:
                emails.append({
                    "id": _str(msg.get("messageId")),
                    "subject": _str(msg.get("subject"), "(no subject)"),
                    "date": msg.get("messageTimestamp", ""),
                    "direction": "received",
                    "from_addr": _str(msg.get("sender")),
                    "to_addr": _str(msg.get("to")),
                    "snippet": _str(msg.get("preview")),
                })

            # Sort by date descending (handles ISO strings and epoch ints)
            def _sort_key(e: dict):
                ts = e.get("date", "")
                if isinstance(ts, (int, float)):
                    return ts
                return ts or ""

            emails.sort(key=_sort_key, reverse=True)
            return emails[:max_results]
        except Exception:
            logger.exception("Failed to get recent emails via Composio")
            return []

    async def get_volume_trend(self, days: int = 30) -> list[dict]:
        """Get daily email count trend for sent and received emails.

        Args:
            days: Number of days to look back.

        Returns:
            List of dicts with date, sent, received, total per day.
        """
        if not self.is_configured():
            return []

        since = datetime.now(timezone.utc) - timedelta(days=days)
        date_str = since.strftime("%Y/%m/%d")

        try:
            sent_result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"in:sent after:{date_str}",
                "max_results": 100,
            })
            sent_msgs = self._extract_messages(sent_result)

            recv_result = await self.composio.call_tool("GMAIL_FETCH_EMAILS", {
                "user_id": "me",
                "q": f"in:inbox after:{date_str}",
                "max_results": 100,
            })
            recv_msgs = self._extract_messages(recv_result)

            sent_by_day: Counter = Counter()
            received_by_day: Counter = Counter()

            for msg in sent_msgs:
                ts = msg.get("messageTimestamp", "")
                if ts:
                    try:
                        # Composio returns timestamps — try ISO or epoch
                        if isinstance(ts, (int, float)):
                            day = datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d")
                        else:
                            day = ts[:10]  # ISO date prefix
                        sent_by_day[day] += 1
                    except Exception:
                        pass

            for msg in recv_msgs:
                ts = msg.get("messageTimestamp", "")
                if ts:
                    try:
                        if isinstance(ts, (int, float)):
                            day = datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d")
                        else:
                            day = ts[:10]
                        received_by_day[day] += 1
                    except Exception:
                        pass

            trend: list[dict] = []
            for i in range(days):
                day = (since + timedelta(days=i + 1)).strftime("%Y-%m-%d")
                trend.append({
                    "date": day,
                    "sent": sent_by_day.get(day, 0),
                    "received": received_by_day.get(day, 0),
                    "total": sent_by_day.get(day, 0) + received_by_day.get(day, 0),
                })

            return trend
        except Exception:
            logger.exception("Failed to get volume trend via Composio")
            return []


def get_gmail_client() -> GmailClient:
    """Return a cached singleton GmailClient instance."""
    global _gmail_client
    if _gmail_client is None:
        _gmail_client = GmailClient()
    return _gmail_client
