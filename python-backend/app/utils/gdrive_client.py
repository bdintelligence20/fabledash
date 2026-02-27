"""Google Drive client powered by Composio MCP for browsing and searching files."""

import logging
from typing import Optional

from app.config import get_settings
from app.utils.composio_client import get_composio_client

logger = logging.getLogger(__name__)


class GoogleDriveClient:
    """Drive client that delegates to Composio MCP tools."""

    def __init__(self):
        settings = get_settings()
        self._root_folder_id = settings.GOOGLE_DRIVE_FOLDER_ID
        self.composio = get_composio_client()

    def is_configured(self) -> bool:
        """Check if Composio is configured for Drive access."""
        return self.composio.is_configured()

    async def list_files(
        self,
        folder_id: Optional[str] = None,
        query: Optional[str] = None,
    ) -> list[dict]:
        """List files and folders in a given folder.

        Args:
            folder_id: The folder to list. Falls back to configured root folder.
            query: Optional additional Drive query filter.

        Returns:
            List of file metadata dicts.
        """
        target = folder_id or self._root_folder_id

        q_parts = []
        if target:
            q_parts.append(f"'{target}' in parents")
        q_parts.append("trashed = false")
        if query:
            q_parts.append(query)

        q = " and ".join(q_parts)

        try:
            result = await self.composio.call_tool("GOOGLEDRIVE_LIST_FILES", {
                "q": q,
                "page_size": 100,
                "fields": "files(id, name, mimeType, modifiedTime, size, webViewLink, parents)",
            })
            return result.get("data", {}).get("files", [])
        except Exception:
            logger.exception("Failed to list Drive files via Composio")
            return []

    async def get_file(self, file_id: str) -> dict:
        """Get metadata for a single file.

        Args:
            file_id: The Google Drive file ID.

        Returns:
            File metadata dict.
        """
        try:
            result = await self.composio.call_tool("GOOGLEDRIVE_GET_FILE_METADATA", {
                "file_id": file_id,
                "fields": "id, name, mimeType, modifiedTime, size, webViewLink, parents, description",
            })
            return result.get("data", {})
        except Exception:
            logger.exception("Failed to get Drive file %s via Composio", file_id)
            return {}

    async def search_files(self, query: str) -> list[dict]:
        """Search files by name across accessible Drive.

        Args:
            query: Search term to match against file names.

        Returns:
            List of matching file metadata dicts.
        """
        try:
            result = await self.composio.call_tool("GOOGLEDRIVE_FIND_FILE", {
                "search_query": query,
                "page_size": 50,
            })
            return result.get("data", {}).get("files", [])
        except Exception:
            logger.exception("Failed to search Drive files via Composio")
            return []

    async def get_client_folder(self, client_name: str) -> Optional[dict]:
        """Find a folder matching a client name.

        Args:
            client_name: The client name to search for.

        Returns:
            Folder metadata dict if found, None otherwise.
        """
        q_parts = [
            f"name contains '{client_name}'",
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
        ]
        if self._root_folder_id:
            q_parts.append(f"'{self._root_folder_id}' in parents")

        q = " and ".join(q_parts)

        try:
            result = await self.composio.call_tool("GOOGLEDRIVE_LIST_FILES", {
                "q": q,
                "page_size": 1,
                "fields": "files(id, name, mimeType, modifiedTime, webViewLink)",
            })
            files = result.get("data", {}).get("files", [])
            return files[0] if files else None
        except Exception:
            logger.exception("Failed to find client folder via Composio")
            return None


_client: Optional[GoogleDriveClient] = None


def get_gdrive_client() -> GoogleDriveClient:
    """Get or create the singleton Google Drive client."""
    global _client
    if _client is None:
        _client = GoogleDriveClient()
    return _client
