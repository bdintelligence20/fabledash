"""Google Drive client for browsing, searching, and linking client documents."""

import logging
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

from app.config import get_settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


class GoogleDriveClient:
    """Client for interacting with Google Drive API."""

    def __init__(self):
        settings = get_settings()
        self._credentials_path = settings.GOOGLE_DRIVE_CREDENTIALS_PATH
        self._root_folder_id = settings.GOOGLE_DRIVE_FOLDER_ID
        self._service = None

    def is_configured(self) -> bool:
        """Check if Google Drive credentials are configured."""
        return bool(self._credentials_path)

    def _get_service(self):
        """Lazily initialize and return the Drive API service."""
        if self._service is None:
            if self._credentials_path:
                creds = service_account.Credentials.from_service_account_file(
                    self._credentials_path, scopes=SCOPES
                )
            else:
                import google.auth

                creds, _ = google.auth.default(scopes=SCOPES)
            self._service = build("drive", "v3", credentials=creds)
        return self._service

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
        service = self._get_service()
        target = folder_id or self._root_folder_id

        q_parts = []
        if target:
            q_parts.append(f"'{target}' in parents")
        q_parts.append("trashed = false")
        if query:
            q_parts.append(query)

        q = " and ".join(q_parts)

        results = (
            service.files()
            .list(
                q=q,
                pageSize=100,
                fields="files(id, name, mimeType, modifiedTime, size, webViewLink, parents)",
            )
            .execute()
        )
        return results.get("files", [])

    async def get_file(self, file_id: str) -> dict:
        """Get metadata for a single file.

        Args:
            file_id: The Google Drive file ID.

        Returns:
            File metadata dict.
        """
        service = self._get_service()
        return (
            service.files()
            .get(
                fileId=file_id,
                fields="id, name, mimeType, modifiedTime, size, webViewLink, parents, description",
            )
            .execute()
        )

    async def search_files(self, query: str) -> list[dict]:
        """Search files by name across accessible Drive.

        Args:
            query: Search term to match against file names.

        Returns:
            List of matching file metadata dicts.
        """
        service = self._get_service()
        q_parts = [
            f"name contains '{query}'",
            "trashed = false",
        ]
        if self._root_folder_id:
            q_parts.append(f"'{self._root_folder_id}' in parents")

        q = " and ".join(q_parts)

        results = (
            service.files()
            .list(
                q=q,
                pageSize=50,
                fields="files(id, name, mimeType, modifiedTime, size, webViewLink, parents)",
            )
            .execute()
        )
        return results.get("files", [])

    async def get_client_folder(self, client_name: str) -> Optional[dict]:
        """Find a folder matching a client name.

        Searches for folders whose name contains the client name within
        the configured root folder.

        Args:
            client_name: The client name to search for.

        Returns:
            Folder metadata dict if found, None otherwise.
        """
        service = self._get_service()
        q_parts = [
            f"name contains '{client_name}'",
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
        ]
        if self._root_folder_id:
            q_parts.append(f"'{self._root_folder_id}' in parents")

        q = " and ".join(q_parts)

        results = (
            service.files()
            .list(
                q=q,
                pageSize=1,
                fields="files(id, name, mimeType, modifiedTime, webViewLink)",
            )
            .execute()
        )
        files = results.get("files", [])
        return files[0] if files else None


_client: Optional[GoogleDriveClient] = None


def get_gdrive_client() -> GoogleDriveClient:
    """Get or create the singleton Google Drive client."""
    global _client
    if _client is None:
        _client = GoogleDriveClient()
    return _client
