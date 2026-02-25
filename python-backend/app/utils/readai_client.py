"""Read.AI API client for fetching meeting data, transcripts, and action items."""

import logging
from datetime import datetime

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_readai_client: "ReadAIClient | None" = None


class ReadAIClient:
    """Async client for the Read.AI REST API.

    Provides methods to fetch meetings, transcripts, action items, and
    summaries from a configured Read.AI account.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.READAI_API_BASE_URL
        self.http = httpx.AsyncClient(timeout=30.0)

    def _headers(self) -> dict[str, str]:
        """Return authorization headers for Read.AI API requests."""
        return {
            "Authorization": f"Bearer {self.settings.READAI_API_KEY}",
            "Content-Type": "application/json",
        }

    def is_configured(self) -> bool:
        """Check whether a Read.AI API key has been provided."""
        return bool(self.settings.READAI_API_KEY)

    async def get_meetings(self, since: datetime | None = None) -> list[dict]:
        """Fetch meetings from Read.AI, optionally filtered by date.

        Args:
            since: Only return meetings after this datetime.

        Returns:
            List of meeting dicts from the Read.AI API.
        """
        if not self.is_configured():
            logger.warning("Read.AI API key not configured")
            return []

        params: dict[str, str] = {}
        if since:
            params["since"] = since.isoformat()

        try:
            response = await self.http.get(
                f"{self.base_url}/meetings",
                headers=self._headers(),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("meetings", data.get("items", []))
        except httpx.HTTPStatusError as exc:
            logger.error("Read.AI get_meetings failed: %s %s", exc.response.status_code, exc.response.text)
            raise
        except httpx.RequestError:
            logger.exception("Read.AI get_meetings request error")
            raise

    async def get_transcript(self, meeting_id: str) -> dict:
        """Fetch the transcript for a specific meeting.

        Args:
            meeting_id: The Read.AI meeting identifier.

        Returns:
            Transcript data dict from the API.
        """
        if not self.is_configured():
            logger.warning("Read.AI API key not configured")
            return {}

        try:
            response = await self.http.get(
                f"{self.base_url}/meetings/{meeting_id}/transcript",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            logger.error("Read.AI get_transcript failed: %s %s", exc.response.status_code, exc.response.text)
            raise
        except httpx.RequestError:
            logger.exception("Read.AI get_transcript request error")
            raise

    async def get_action_items(self, meeting_id: str) -> list[dict]:
        """Fetch action items for a specific meeting.

        Args:
            meeting_id: The Read.AI meeting identifier.

        Returns:
            List of action item dicts.
        """
        if not self.is_configured():
            logger.warning("Read.AI API key not configured")
            return []

        try:
            response = await self.http.get(
                f"{self.base_url}/meetings/{meeting_id}/action_items",
                headers=self._headers(),
            )
            response.raise_for_status()
            data = response.json()
            return data.get("action_items", data.get("items", []))
        except httpx.HTTPStatusError as exc:
            logger.error("Read.AI get_action_items failed: %s %s", exc.response.status_code, exc.response.text)
            raise
        except httpx.RequestError:
            logger.exception("Read.AI get_action_items request error")
            raise

    async def get_summary(self, meeting_id: str) -> dict:
        """Fetch the AI-generated summary for a specific meeting.

        Args:
            meeting_id: The Read.AI meeting identifier.

        Returns:
            Summary data dict from the API.
        """
        if not self.is_configured():
            logger.warning("Read.AI API key not configured")
            return {}

        try:
            response = await self.http.get(
                f"{self.base_url}/meetings/{meeting_id}/summary",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            logger.error("Read.AI get_summary failed: %s %s", exc.response.status_code, exc.response.text)
            raise
        except httpx.RequestError:
            logger.exception("Read.AI get_summary request error")
            raise


def get_readai_client() -> ReadAIClient:
    """Return a cached singleton ReadAIClient instance."""
    global _readai_client
    if _readai_client is None:
        _readai_client = ReadAIClient()
    return _readai_client
