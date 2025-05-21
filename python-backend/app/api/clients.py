from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import List, Optional
import logging

from app.models.client import (
    Client, ClientCreate, ClientUpdate, ClientResponse, ClientsResponse
)
from app.utils.supabase_client import get_supabase_client

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Get Supabase client
supabase = get_supabase_client()

@router.get("/", response_model=ClientsResponse)
async def get_clients():
    """
    Get all clients.
    """
    try:
        result = supabase.table("clients").select("*").order("name").execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching clients: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching clients: {result.error}")
        
        return {"success": True, "clients": result.data}
    except Exception as e:
        logger.error(f"Error fetching clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(client_id: int = Path(..., description="The ID of the client to get")):
    """
    Get a specific client by ID.
    """
    try:
        result = supabase.table("clients").select("*").eq("id", client_id).single().execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Client not found: {result.error}")
            raise HTTPException(status_code=404, detail=f"Client not found: {result.error}")
        
        return {"success": True, "client": result.data}
    except Exception as e:
        logger.error(f"Error fetching client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ClientResponse)
async def create_client(client: ClientCreate):
    """
    Create a new client.
    """
    try:
        result = supabase.table("clients").insert(client.dict()).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error creating client: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating client: {result.error}")
        
        return {"success": True, "client": result.data[0]}
    except Exception as e:
        logger.error(f"Error creating client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client: ClientUpdate,
    client_id: int = Path(..., description="The ID of the client to update")
):
    """
    Update an existing client.
    """
    try:
        # Check if client exists
        client_result = supabase.table("clients").select("*").eq("id", client_id).single().execute()
        
        if hasattr(client_result, 'error') and client_result.error:
            logger.error(f"Client not found: {client_result.error}")
            raise HTTPException(status_code=404, detail=f"Client not found: {client_result.error}")
        
        # Update client
        update_data = {k: v for k, v in client.dict().items() if v is not None}
        result = supabase.table("clients").update(update_data).eq("id", client_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error updating client: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error updating client: {result.error}")
        
        return {"success": True, "client": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{client_id}", response_model=ClientResponse)
async def delete_client(client_id: int = Path(..., description="The ID of the client to delete")):
    """
    Delete a client.
    """
    try:
        # Check if client exists
        client_result = supabase.table("clients").select("*").eq("id", client_id).single().execute()
        
        if hasattr(client_result, 'error') and client_result.error:
            logger.error(f"Client not found: {client_result.error}")
            raise HTTPException(status_code=404, detail=f"Client not found: {client_result.error}")
        
        # Check if client has agents
        agents_result = supabase.table("agents").select("id").eq("client_id", client_id).execute()
        
        if hasattr(agents_result, 'error') and agents_result.error:
            logger.error(f"Error checking client agents: {agents_result.error}")
            raise HTTPException(status_code=500, detail=f"Error checking client agents: {agents_result.error}")
        
        if agents_result.data:
            logger.error(f"Client has agents: {agents_result.data}")
            raise HTTPException(status_code=400, detail="Cannot delete client with associated agents")
        
        # Check if client has tasks
        tasks_result = supabase.table("tasks").select("id").eq("client_id", client_id).execute()
        
        if hasattr(tasks_result, 'error') and tasks_result.error:
            logger.error(f"Error checking client tasks: {tasks_result.error}")
            raise HTTPException(status_code=500, detail=f"Error checking client tasks: {tasks_result.error}")
        
        if tasks_result.data:
            logger.error(f"Client has tasks: {tasks_result.data}")
            raise HTTPException(status_code=400, detail="Cannot delete client with associated tasks")
        
        # Delete client
        result = supabase.table("clients").delete().eq("id", client_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error deleting client: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting client: {result.error}")
        
        return {"success": True, "client": client_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting client: {e}")
        raise HTTPException(status_code=500, detail=str(e))
