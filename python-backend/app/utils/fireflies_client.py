"""Fireflies.ai GraphQL API client for fetching meeting transcripts and summaries."""

import logging
from datetime import datetime

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_fireflies_client: "FirefliesClient | None" = None


class FirefliesClient:
    """Async client for the Fireflies.ai GraphQL API.

    Provides methods to fetch transcripts and summaries from a configured
    Fireflies account using GraphQL queries.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.FIREFLIES_API_BASE_URL
        self.http = httpx.AsyncClient(timeout=30.0)

    def _headers(self) -> dict[str, str]:
        """Return authorization headers for Fireflies API requests."""
        return {
            "Authorization": f"Bearer {self.settings.FIREFLIES_API_KEY}",
            "Content-Type": "application/json",
        }

    def is_configured(self) -> bool:
        """Check whether a Fireflies API key has been provided."""
        return bool(self.settings.FIREFLIES_API_KEY)

    async def _graphql_request(self, query: str, variables: dict | None = None) -> dict:
        """Execute a GraphQL request against the Fireflies API.

        Args:
            query: GraphQL query string.
            variables: Optional variables for the query.

        Returns:
            The 'data' portion of the GraphQL response.

        Raises:
            httpx.HTTPStatusError: If the HTTP request fails.
            RuntimeError: If the GraphQL response contains errors.
        """
        payload: dict = {"query": query}
        if variables:
            payload["variables"] = variables

        try:
            response = await self.http.post(
                self.base_url,
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

            if "errors" in result:
                errors = result["errors"]
                logger.error("Fireflies GraphQL errors: %s", errors)
                raise RuntimeError(f"Fireflies GraphQL errors: {errors}")

            return result.get("data", {})
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Fireflies request failed: %s %s",
                exc.response.status_code,
                exc.response.text,
            )
            raise
        except httpx.RequestError:
            logger.exception("Fireflies request error")
            raise

    async def get_transcripts(self, since: datetime | None = None) -> list[dict]:
        """Fetch transcripts from Fireflies, optionally filtered by date.

        Args:
            since: Only return transcripts after this datetime.

        Returns:
            List of transcript dicts from the Fireflies API.
        """
        if not self.is_configured():
            logger.warning("Fireflies API key not configured")
            return []

        query = """
        query GetTranscripts($since: DateTime) {
            transcripts(since: $since) {
                id
                title
                date
                duration
                participants
                transcript_url
                summary {
                    overview
                    action_items
                    keywords
                }
            }
        }
        """
        variables: dict = {}
        if since:
            variables["since"] = since.isoformat()

        data = await self._graphql_request(query, variables or None)
        return data.get("transcripts", [])

    async def get_transcript(self, transcript_id: str) -> dict:
        """Fetch a specific transcript by ID.

        Args:
            transcript_id: The Fireflies transcript identifier.

        Returns:
            Transcript data dict including sentences.
        """
        if not self.is_configured():
            logger.warning("Fireflies API key not configured")
            return {}

        query = """
        query GetTranscript($id: String!) {
            transcript(id: $id) {
                id
                title
                date
                duration
                participants
                sentences {
                    speaker_name
                    text
                    start_time
                    end_time
                }
                summary {
                    overview
                    action_items
                    keywords
                }
            }
        }
        """
        data = await self._graphql_request(query, {"id": transcript_id})
        return data.get("transcript", {})

    async def get_summary(self, transcript_id: str) -> dict:
        """Fetch the summary for a specific transcript.

        Args:
            transcript_id: The Fireflies transcript identifier.

        Returns:
            Summary data dict with overview, action items, and keywords.
        """
        if not self.is_configured():
            logger.warning("Fireflies API key not configured")
            return {}

        query = """
        query GetSummary($id: String!) {
            transcript(id: $id) {
                id
                title
                summary {
                    overview
                    action_items
                    keywords
                    outline
                }
            }
        }
        """
        data = await self._graphql_request(query, {"id": transcript_id})
        return data.get("transcript", {}).get("summary", {})


def get_fireflies_client() -> FirefliesClient:
    """Return a cached singleton FirefliesClient instance."""
    global _fireflies_client
    if _fireflies_client is None:
        _fireflies_client = FirefliesClient()
    return _fireflies_client
