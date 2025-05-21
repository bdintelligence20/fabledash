from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import List, Optional
import logging

from app.models.agent import (
    Agent, AgentCreate, AgentUpdate, AgentResponse, AgentsResponse
)
from app.utils.supabase_client import get_supabase_client

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Get Supabase client
supabase = get_supabase_client()

@router.get("/", response_model=AgentsResponse)
async def get_agents():
    """
    Get all agents.
    """
    try:
        result = supabase.table("agents").select("*").order("created_at", desc=True).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching agents: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching agents: {result.error}")
        
        return {"success": True, "agents": result.data}
    except Exception as e:
        logger.error(f"Error fetching agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: int = Path(..., description="The ID of the agent to get")):
    """
    Get a specific agent by ID.
    """
    try:
        result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching agent: {result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {result.error}")
        
        return {"success": True, "agent": result.data}
    except Exception as e:
        logger.error(f"Error fetching agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate):
    """
    Create a new agent.
    """
    try:
        # If this is a child agent, verify that the parent exists
        if agent.parent_id:
            parent_result = supabase.table("agents").select("id").eq("id", agent.parent_id).single().execute()
            
            if hasattr(parent_result, 'error') and parent_result.error:
                logger.error(f"Parent agent not found: {parent_result.error}")
                raise HTTPException(status_code=404, detail=f"Parent agent not found: {parent_result.error}")
        
        # Create agent
        result = supabase.table("agents").insert(agent.dict()).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error creating agent: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating agent: {result.error}")
        
        return {"success": True, "agent": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent: AgentUpdate,
    agent_id: int = Path(..., description="The ID of the agent to update")
):
    """
    Update an existing agent.
    """
    try:
        # Check if agent exists
        agent_result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Agent not found: {agent_result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {agent_result.error}")
        
        # If updating parent_id, verify that the parent exists
        if agent.parent_id:
            parent_result = supabase.table("agents").select("id").eq("id", agent.parent_id).single().execute()
            
            if hasattr(parent_result, 'error') and parent_result.error:
                logger.error(f"Parent agent not found: {parent_result.error}")
                raise HTTPException(status_code=404, detail=f"Parent agent not found: {parent_result.error}")
        
        # Update agent
        update_data = {k: v for k, v in agent.dict().items() if v is not None}
        result = supabase.table("agents").update(update_data).eq("id", agent_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error updating agent: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error updating agent: {result.error}")
        
        return {"success": True, "agent": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{agent_id}", response_model=AgentResponse)
async def delete_agent(agent_id: int = Path(..., description="The ID of the agent to delete")):
    """
    Delete an agent.
    """
    try:
        # Check if agent exists
        agent_result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Agent not found: {agent_result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {agent_result.error}")
        
        # Check if agent has child agents
        child_agents_result = supabase.table("agents").select("id").eq("parent_id", agent_id).execute()
        
        if hasattr(child_agents_result, 'error') and child_agents_result.error:
            logger.error(f"Error checking child agents: {child_agents_result.error}")
            raise HTTPException(status_code=500, detail=f"Error checking child agents: {child_agents_result.error}")
        
        if child_agents_result.data:
            logger.error(f"Agent has child agents: {child_agents_result.data}")
            raise HTTPException(status_code=400, detail="Cannot delete agent with child agents")
        
        # Delete agent's documents
        documents_result = supabase.table("documents").select("id").eq("agent_id", agent_id).execute()
        
        if hasattr(documents_result, 'error') and documents_result.error:
            logger.error(f"Error fetching agent documents: {documents_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching agent documents: {documents_result.error}")
        
        for document in documents_result.data:
            # Delete document chunks
            chunks_result = supabase.table("document_chunks").delete().eq("document_id", document["id"]).execute()
            
            if hasattr(chunks_result, 'error') and chunks_result.error:
                logger.error(f"Error deleting document chunks: {chunks_result.error}")
                raise HTTPException(status_code=500, detail=f"Error deleting document chunks: {chunks_result.error}")
            
            # Delete document
            doc_result = supabase.table("documents").delete().eq("id", document["id"]).execute()
            
            if hasattr(doc_result, 'error') and doc_result.error:
                logger.error(f"Error deleting document: {doc_result.error}")
                raise HTTPException(status_code=500, detail=f"Error deleting document: {doc_result.error}")
        
        # Delete agent's chats
        chats_result = supabase.table("chats").select("id").eq("agent_id", agent_id).execute()
        
        if hasattr(chats_result, 'error') and chats_result.error:
            logger.error(f"Error fetching agent chats: {chats_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching agent chats: {chats_result.error}")
        
        for chat in chats_result.data:
            # Delete chat messages
            messages_result = supabase.table("messages").delete().eq("chat_id", chat["id"]).execute()
            
            if hasattr(messages_result, 'error') and messages_result.error:
                logger.error(f"Error deleting chat messages: {messages_result.error}")
                raise HTTPException(status_code=500, detail=f"Error deleting chat messages: {messages_result.error}")
            
            # Delete chat
            chat_result = supabase.table("chats").delete().eq("id", chat["id"]).execute()
            
            if hasattr(chat_result, 'error') and chat_result.error:
                logger.error(f"Error deleting chat: {chat_result.error}")
                raise HTTPException(status_code=500, detail=f"Error deleting chat: {chat_result.error}")
        
        # Delete agent
        result = supabase.table("agents").delete().eq("id", agent_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error deleting agent: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting agent: {result.error}")
        
        return {"success": True, "agent": agent_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/parent/{parent_id}/children", response_model=AgentsResponse)
async def get_child_agents(parent_id: int = Path(..., description="The ID of the parent agent")):
    """
    Get all child agents for a parent agent.
    """
    try:
        # Check if parent agent exists
        parent_result = supabase.table("agents").select("*").eq("id", parent_id).single().execute()
        
        if hasattr(parent_result, 'error') and parent_result.error:
            logger.error(f"Parent agent not found: {parent_result.error}")
            raise HTTPException(status_code=404, detail=f"Parent agent not found: {parent_result.error}")
        
        # Get child agents
        result = supabase.table("agents").select("*").eq("parent_id", parent_id).order("created_at", desc=True).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching child agents: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching child agents: {result.error}")
        
        return {"success": True, "agents": result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching child agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))
