"""Tests for document API endpoints."""

import pytest


class TestListDocuments:
    def test_list_documents(self, client):
        response = client.get("/documents/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_list_documents_filter_status(self, client):
        response = client.get("/documents/?status=ready")
        assert response.status_code == 200

    def test_list_documents_filter_agent_id(self, client):
        response = client.get("/documents/?agent_id=agent_1")
        assert response.status_code == 200


class TestGetDocument:
    def test_get_document_success(self, client):
        response = client.get("/documents/doc_1")
        assert response.status_code == 200

    def test_get_document_not_found(self, client):
        response = client.get("/documents/nonexistent")
        assert response.status_code == 404


class TestGetDocumentChunks:
    def test_get_chunks_success(self, client):
        response = client.get("/documents/doc_1/chunks")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_get_chunks_doc_not_found(self, client):
        response = client.get("/documents/nonexistent/chunks")
        assert response.status_code == 404


class TestDeleteDocument:
    def test_delete_document_success(self, client):
        response = client.delete("/documents/doc_1")
        assert response.status_code == 200

    def test_delete_document_not_found(self, client):
        response = client.delete("/documents/nonexistent")
        assert response.status_code == 404
