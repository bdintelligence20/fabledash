"""Composio MCP client for Gmail, Google Drive, Docs, Sheets, and Calendar.

Composio exposes 181 tools via a single MCP endpoint using Streamable HTTP
transport.  This client handles session initialization, tool invocation,
and SSE response parsing.
"""

import json
import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_composio_client: "ComposioClient | None" = None


class ComposioClient:
    """Generic async client for calling Composio MCP tools."""

    def __init__(self) -> None:
        settings = get_settings()
        self.mcp_url = settings.COMPOSIO_MCP_URL
        self.api_key = settings.COMPOSIO_API_KEY
        self.http = httpx.AsyncClient(timeout=60.0)

    def is_configured(self) -> bool:
        """Return True if Composio MCP URL and API key are set."""
        return bool(self.mcp_url and self.api_key)

    async def call_tool(self, tool_name: str, arguments: dict | None = None) -> dict | list | str:
        """Call a Composio MCP tool and return the parsed result.

        Args:
            tool_name: The MCP tool name (e.g. GMAIL_FETCH_EMAILS).
            arguments: Tool arguments dict.

        Returns:
            Parsed result from the tool (dict, list, or string).
        """
        if not self.is_configured():
            raise RuntimeError("Composio MCP not configured")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "x-api-key": self.api_key,
        }

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
        await self.http.post(self.mcp_url, headers=headers, json=init_msg)

        # Call the tool
        tool_msg = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "id": 2,
            "params": {
                "name": tool_name,
                "arguments": arguments or {},
            },
        }
        resp = await self.http.post(self.mcp_url, headers=headers, json=tool_msg)
        resp.raise_for_status()

        # Parse SSE response
        for line in resp.text.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])

                # Check for errors
                if "error" in data:
                    error = data["error"]
                    raise RuntimeError(f"Composio tool error: {error.get('message', error)}")

                if "result" in data:
                    for content in data["result"].get("content", []):
                        if content.get("type") == "text":
                            text = content["text"]
                            # Try to parse as JSON
                            try:
                                return json.loads(text)
                            except (json.JSONDecodeError, TypeError):
                                return text

        return {}


def get_composio_client() -> ComposioClient:
    """Return a cached singleton ComposioClient instance."""
    global _composio_client
    if _composio_client is None:
        _composio_client = ComposioClient()
    return _composio_client
