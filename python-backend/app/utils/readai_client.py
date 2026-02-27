"""Read.AI API client with OAuth 2.0 token management.

Access tokens expire every 10 minutes.  This client automatically refreshes
them using the stored refresh token.  Because Read.AI *rotates* refresh
tokens on every use, the new refresh token is persisted back to Firestore
so it survives process restarts.

Meeting listings come from the REST API (``/v1/meetings``).
Rich data (transcripts, summaries, action items, topics) comes from the
MCP protocol endpoint (``/mcp``) which exposes a ``get_meeting_by_id`` tool
with an ``expand`` parameter.
"""

import json
import logging
import time
from datetime import datetime

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_readai_client: "ReadAIClient | None" = None

# Firestore document used to persist the latest refresh token
_TOKEN_DOC_PATH = ("_meta", "readai_oauth")

# MCP endpoint for rich meeting data
_MCP_URL = "https://api.read.ai/mcp"


class ReadAIClient:
    """Async client for the Read.AI REST + MCP API with automatic OAuth refresh."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.READAI_API_BASE_URL
        self.token_url = self.settings.READAI_TOKEN_URL
        self.client_id = self.settings.READAI_CLIENT_ID
        self.client_secret = self.settings.READAI_CLIENT_SECRET
        self.http = httpx.AsyncClient(timeout=30.0)

        # In-memory token cache
        self._access_token: str = ""
        self._token_expires_at: float = 0.0
        self._refresh_token: str = self.settings.READAI_REFRESH_TOKEN

        # Try to load a newer refresh token from Firestore (best-effort)
        self._load_persisted_token()

    # ------------------------------------------------------------------
    # Configuration check
    # ------------------------------------------------------------------

    def is_configured(self) -> bool:
        """Return True if all OAuth credentials are present."""
        return bool(self.client_id and self.client_secret and self._refresh_token)

    # ------------------------------------------------------------------
    # Token management
    # ------------------------------------------------------------------

    def _load_persisted_token(self) -> None:
        """Load the latest refresh token from Firestore if available."""
        try:
            from app.utils.firebase_client import get_firestore_client

            db = get_firestore_client()
            doc = db.collection(_TOKEN_DOC_PATH[0]).document(_TOKEN_DOC_PATH[1]).get()
            if doc.exists:
                data = doc.to_dict()
                stored_token = data.get("refresh_token", "")
                if stored_token:
                    self._refresh_token = stored_token
                    logger.debug("Loaded persisted Read.AI refresh token")
        except Exception:
            logger.debug("Could not load persisted Read.AI token, using .env value")

    def _persist_refresh_token(self, token: str) -> None:
        """Save the latest refresh token to Firestore for durability."""
        try:
            from app.utils.firebase_client import get_firestore_client

            db = get_firestore_client()
            db.collection(_TOKEN_DOC_PATH[0]).document(_TOKEN_DOC_PATH[1]).set({
                "refresh_token": token,
                "updated_at": datetime.utcnow().isoformat(),
            })
        except Exception:
            logger.warning("Could not persist Read.AI refresh token to Firestore")

    async def _ensure_access_token(self) -> str:
        """Return a valid access token, refreshing if needed."""
        # Leave a 30-second buffer before expiry
        if self._access_token and time.time() < (self._token_expires_at - 30):
            return self._access_token

        if not self._refresh_token:
            raise RuntimeError("Read.AI refresh token not configured")

        logger.debug("Refreshing Read.AI access token")

        response = await self.http.post(
            self.token_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=(self.client_id, self.client_secret),
            data={
                "grant_type": "refresh_token",
                "refresh_token": self._refresh_token,
            },
        )
        response.raise_for_status()
        data = response.json()

        self._access_token = data["access_token"]
        self._token_expires_at = time.time() + data.get("expires_in", 600)

        # Read.AI rotates refresh tokens — persist the new one
        new_refresh = data.get("refresh_token", "")
        if new_refresh and new_refresh != self._refresh_token:
            self._refresh_token = new_refresh
            self._persist_refresh_token(new_refresh)

        return self._access_token

    async def _headers(self) -> dict[str, str]:
        """Return authorization headers with a valid access token."""
        token = await self._ensure_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # MCP helper
    # ------------------------------------------------------------------

    async def _mcp_call(self, tool_name: str, arguments: dict) -> dict:
        """Call a Read.AI MCP tool and return the parsed result.

        The MCP endpoint uses Streamable HTTP transport with SSE responses.
        """
        headers = await self._headers()
        headers["Accept"] = "application/json, text/event-stream"

        # Initialize MCP session
        init_msg = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "id": 1,
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "fable-dashboard", "version": "1.0"},
            },
        }
        await self.http.post(_MCP_URL, headers=headers, json=init_msg)

        # Call the tool
        tool_msg = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "id": 2,
            "params": {"name": tool_name, "arguments": arguments},
        }
        resp = await self.http.post(_MCP_URL, headers=headers, json=tool_msg)
        resp.raise_for_status()

        # Parse SSE response
        for line in resp.text.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                if "result" in data:
                    for content in data["result"].get("content", []):
                        if content.get("type") == "text":
                            return json.loads(content["text"])

        return {}

    # ------------------------------------------------------------------
    # REST API — meeting listings
    # ------------------------------------------------------------------

    async def get_meetings(self, since: datetime | None = None) -> list[dict]:
        """Fetch meetings from Read.AI, optionally filtered by date."""
        if not self.is_configured():
            logger.warning("Read.AI not configured")
            return []

        params: dict[str, str] = {}
        if since:
            params["since"] = since.isoformat()

        try:
            response = await self.http.get(
                f"{self.base_url}/meetings",
                headers=await self._headers(),
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("data", data.get("meetings", data.get("items", [])))
        except httpx.HTTPStatusError as exc:
            logger.error("Read.AI get_meetings failed: %s %s", exc.response.status_code, exc.response.text)
            raise
        except httpx.RequestError:
            logger.exception("Read.AI get_meetings request error")
            raise

    # ------------------------------------------------------------------
    # MCP API — rich meeting data
    # ------------------------------------------------------------------

    async def get_meeting_detail(
        self,
        meeting_id: str,
        expand: list[str] | None = None,
    ) -> dict:
        """Fetch a single meeting with optional expanded fields via MCP.

        Args:
            meeting_id: The Read.AI meeting ULID.
            expand: Fields to expand. Options: summary, chapter_summaries,
                    action_items, key_questions, topics, transcript, metrics,
                    recording_download.

        Returns:
            Full meeting dict with requested expansions populated.
        """
        if not self.is_configured():
            logger.warning("Read.AI not configured")
            return {}

        args: dict = {"id": meeting_id}
        if expand:
            args["expand"] = expand

        try:
            return await self._mcp_call("get_meeting_by_id", args)
        except Exception:
            logger.exception("Read.AI get_meeting_detail failed for %s", meeting_id)
            raise

    async def get_transcript(self, meeting_id: str) -> dict:
        """Fetch the transcript for a specific meeting via MCP."""
        result = await self.get_meeting_detail(meeting_id, expand=["transcript"])
        return result.get("transcript") or {}

    async def get_action_items(self, meeting_id: str) -> list[str]:
        """Fetch action items for a specific meeting via MCP."""
        result = await self.get_meeting_detail(meeting_id, expand=["action_items"])
        return result.get("action_items") or []

    async def get_summary(self, meeting_id: str) -> str:
        """Fetch the AI-generated summary for a specific meeting via MCP."""
        result = await self.get_meeting_detail(meeting_id, expand=["summary"])
        return result.get("summary") or ""

    async def get_topics(self, meeting_id: str) -> list[str]:
        """Fetch topics discussed in a specific meeting via MCP."""
        result = await self.get_meeting_detail(meeting_id, expand=["topics"])
        return result.get("topics") or []


def get_readai_client() -> ReadAIClient:
    """Return a cached singleton ReadAIClient instance."""
    global _readai_client
    if _readai_client is None:
        _readai_client = ReadAIClient()
    return _readai_client
