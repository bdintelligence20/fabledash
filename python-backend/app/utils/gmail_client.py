"""Gmail API client for communication pattern analysis and email statistics."""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_gmail_client: "GmailClient | None" = None

# Gmail API base URL
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"


class GmailClient:
    """Async client for the Gmail API.

    Provides methods to analyze communication patterns: email volume trends,
    top correspondents, and per-client email history.
    """

    def __init__(self, credentials: dict | None = None) -> None:
        self.settings = get_settings()
        self.credentials = credentials
        self.http = httpx.AsyncClient(timeout=30.0)

    def is_configured(self) -> bool:
        """Check whether Gmail credentials have been provided."""
        return self.credentials is not None and bool(self.credentials.get("access_token"))

    def _headers(self) -> dict[str, str]:
        """Return authorization headers for Gmail API requests."""
        token = self.credentials.get("access_token", "") if self.credentials else ""
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def _list_messages(
        self, query: str, max_results: int = 500
    ) -> list[dict]:
        """List message IDs matching a Gmail search query.

        Args:
            query: Gmail search query string (e.g. 'after:2024/01/01').
            max_results: Maximum number of messages to return.

        Returns:
            List of message stub dicts with 'id' and 'threadId'.
        """
        if not self.is_configured():
            logger.warning("Gmail not configured")
            return []

        all_messages: list[dict] = []
        page_token: str | None = None

        try:
            while len(all_messages) < max_results:
                params: dict = {
                    "q": query,
                    "maxResults": min(100, max_results - len(all_messages)),
                }
                if page_token:
                    params["pageToken"] = page_token

                response = await self.http.get(
                    f"{GMAIL_API_BASE}/users/me/messages",
                    headers=self._headers(),
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                messages = data.get("messages", [])
                all_messages.extend(messages)

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

            return all_messages[:max_results]
        except httpx.HTTPStatusError as exc:
            logger.error("Gmail list messages failed: %s %s", exc.response.status_code, exc.response.text)
            return []
        except httpx.RequestError:
            logger.exception("Gmail request error")
            return []

    async def _get_message_metadata(self, message_id: str) -> dict:
        """Fetch metadata (headers) for a single message.

        Args:
            message_id: The Gmail message ID.

        Returns:
            Message metadata dict with headers parsed into a flat structure.
        """
        try:
            response = await self.http.get(
                f"{GMAIL_API_BASE}/users/me/messages/{message_id}",
                headers=self._headers(),
                params={"format": "metadata", "metadataHeaders": ["From", "To", "Date", "Subject"]},
            )
            response.raise_for_status()
            data = response.json()

            headers = {}
            for header in data.get("payload", {}).get("headers", []):
                headers[header["name"].lower()] = header["value"]

            return {
                "id": data.get("id"),
                "thread_id": data.get("threadId"),
                "label_ids": data.get("labelIds", []),
                "from": headers.get("from", ""),
                "to": headers.get("to", ""),
                "date": headers.get("date", ""),
                "subject": headers.get("subject", ""),
                "snippet": data.get("snippet", ""),
            }
        except (httpx.HTTPStatusError, httpx.RequestError):
            logger.exception("Failed to fetch message %s", message_id)
            return {}

    async def get_email_stats(self, days: int = 30) -> dict:
        """Count emails sent and received per day, identify top correspondents.

        Args:
            days: Number of days to look back.

        Returns:
            Dict with sent_count, received_count, per_day breakdown,
            and top_correspondents list.
        """
        if not self.is_configured():
            return {"configured": False}

        since = datetime.now(timezone.utc) - timedelta(days=days)
        date_str = since.strftime("%Y/%m/%d")

        # Get sent and received messages
        sent_msgs = await self._list_messages(f"in:sent after:{date_str}", max_results=500)
        received_msgs = await self._list_messages(f"in:inbox after:{date_str}", max_results=500)

        # Count correspondents from sent messages (sample up to 100 for efficiency)
        correspondent_counter: Counter = Counter()
        sample_sent = sent_msgs[:100]
        for msg_stub in sample_sent:
            meta = await self._get_message_metadata(msg_stub["id"])
            if meta.get("to"):
                # Extract email address from "Name <email>" format
                to_addr = meta["to"].split("<")[-1].rstrip(">").strip()
                correspondent_counter[to_addr] += 1

        sample_received = received_msgs[:100]
        for msg_stub in sample_received:
            meta = await self._get_message_metadata(msg_stub["id"])
            if meta.get("from"):
                from_addr = meta["from"].split("<")[-1].rstrip(">").strip()
                correspondent_counter[from_addr] += 1

        top_correspondents = [
            {"email": email, "count": count}
            for email, count in correspondent_counter.most_common(10)
        ]

        return {
            "configured": True,
            "period_days": days,
            "sent_count": len(sent_msgs),
            "received_count": len(received_msgs),
            "total_count": len(sent_msgs) + len(received_msgs),
            "top_correspondents": top_correspondents,
        }

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

        messages = await self._list_messages(
            f"from:{client_email} OR to:{client_email} after:{date_str}",
            max_results=100,
        )

        emails: list[dict] = []
        for msg_stub in messages:
            meta = await self._get_message_metadata(msg_stub["id"])
            if not meta:
                continue

            # Determine direction
            from_addr = meta.get("from", "").lower()
            direction = "received" if client_email.lower() in from_addr else "sent"

            emails.append({
                "id": meta.get("id"),
                "subject": meta.get("subject", "(no subject)"),
                "date": meta.get("date", ""),
                "direction": direction,
                "snippet": meta.get("snippet", ""),
            })

        return emails

    async def get_volume_trend(self, days: int = 30) -> list[dict]:
        """Get daily email count trend for sent and received emails.

        Args:
            days: Number of days to look back.

        Returns:
            List of dicts with date, sent_count, received_count per day.
        """
        if not self.is_configured():
            return []

        since = datetime.now(timezone.utc) - timedelta(days=days)
        date_str = since.strftime("%Y/%m/%d")

        sent_msgs = await self._list_messages(f"in:sent after:{date_str}", max_results=500)
        received_msgs = await self._list_messages(f"in:inbox after:{date_str}", max_results=500)

        # Build day-by-day counts by sampling message dates
        sent_by_day: Counter = Counter()
        received_by_day: Counter = Counter()

        # Sample sent messages for date distribution
        for msg_stub in sent_msgs[:200]:
            meta = await self._get_message_metadata(msg_stub["id"])
            if meta.get("date"):
                try:
                    # Parse the date header (various formats)
                    date_part = meta["date"].split(",")[-1].strip().split(" +")[0].split(" -")[0].strip()
                    # Try common format: "26 Feb 2026 10:30:00"
                    for fmt in ("%d %b %Y %H:%M:%S", "%d %b %Y", "%Y-%m-%d"):
                        try:
                            parsed = datetime.strptime(date_part, fmt)
                            sent_by_day[parsed.strftime("%Y-%m-%d")] += 1
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass

        for msg_stub in received_msgs[:200]:
            meta = await self._get_message_metadata(msg_stub["id"])
            if meta.get("date"):
                try:
                    date_part = meta["date"].split(",")[-1].strip().split(" +")[0].split(" -")[0].strip()
                    for fmt in ("%d %b %Y %H:%M:%S", "%d %b %Y", "%Y-%m-%d"):
                        try:
                            parsed = datetime.strptime(date_part, fmt)
                            received_by_day[parsed.strftime("%Y-%m-%d")] += 1
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass

        # Build trend list for each day in range
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


def get_gmail_client() -> GmailClient:
    """Return a cached singleton GmailClient instance."""
    global _gmail_client
    if _gmail_client is None:
        _gmail_client = GmailClient()
    return _gmail_client
