from fastapi import APIRouter, HTTPException, Depends, Query, Path, Body
from typing import List, Optional
import logging

from app.models.chat import (
    Chat, ChatCreate, Message, MessageCreate, ChatResponse, ChatsResponse,
    ChatWithMessagesResponse, MessagesResponse, LinkedChatsResponse, ChatHistoryResponse
)
from app.models.agent import Agent
from app.utils.supabase_client import get_supabase_client
from app.utils.openai_client import get_openai_client, safe_api_call
from app.services.document_processor import retrieve_relevant_chunks, format_chunks_as_context, retrieve_child_agent_chat_history, format_chat_history_as_context

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Get Supabase client
supabase = get_supabase_client()

# Get OpenAI client
openai_client = get_openai_client()

@router.post("/", response_model=ChatResponse)
async def create_chat(chat: ChatCreate):
    """
    Create a new chat.
    """
    try:
        # Check if agent exists
        agent_result = supabase.table("agents").select("*").eq("id", chat.agent_id).single().execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Agent not found: {agent_result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {agent_result.error}")
        
        agent = agent_result.data
        
        # If parent_chat_id is provided, verify it exists
        if chat.parent_chat_id:
            parent_chat_result = supabase.table("chats").select("id").eq("id", chat.parent_chat_id).single().execute()
            
            if hasattr(parent_chat_result, 'error') and parent_chat_result.error:
                logger.error(f"Parent chat not found: {parent_chat_result.error}")
                raise HTTPException(status_code=404, detail=f"Parent chat not found: {parent_chat_result.error}")
        
        # Create chat
        chat_data = chat.dict()
        if not chat_data.get("title"):
            chat_data["title"] = f"Chat with {agent['name']}"
            
        result = supabase.table("chats").insert(chat_data).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error creating chat: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating chat: {result.error}")
        
        chat_id = result.data[0]["id"]
        
        # Add system message
        system_message = {
            "chat_id": chat_id,
            "role": "system",
            "content": f"You are an AI assistant named {agent['name']}. {agent.get('description', '')}"
        }
        
        message_result = supabase.table("messages").insert(system_message).execute()
        
        if hasattr(message_result, 'error') and message_result.error:
            logger.error(f"Error creating system message: {message_result.error}")
            # Continue anyway, not critical
        
        return {"success": True, "chat": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent/{agent_id}", response_model=ChatsResponse)
async def get_agent_chats(agent_id: int = Path(..., description="The ID of the agent")):
    """
    Get all chats for an agent.
    """
    try:
        # Check if agent exists
        agent_result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Agent not found: {agent_result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {agent_result.error}")
        
        # Get chats
        result = supabase.table("chats").select("*").eq("agent_id", agent_id).order("created_at", desc=True).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching chats: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching chats: {result.error}")
        
        return {"success": True, "chats": result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{chat_id}", response_model=ChatWithMessagesResponse)
async def get_chat(chat_id: int = Path(..., description="The ID of the chat to get")):
    """
    Get a specific chat by ID with its messages.
    """
    try:
        # Get chat
        chat_result = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        
        if hasattr(chat_result, 'error') and chat_result.error:
            logger.error(f"Chat not found: {chat_result.error}")
            raise HTTPException(status_code=404, detail=f"Chat not found: {chat_result.error}")
        
        # Get messages
        messages_result = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute()
        
        if hasattr(messages_result, 'error') and messages_result.error:
            logger.error(f"Error fetching messages: {messages_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching messages: {messages_result.error}")
        
        return {
            "success": True,
            "chat": chat_result.data,
            "messages": messages_result.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{chat_id}/message", response_model=MessagesResponse)
async def send_message(
    message: str = Body(..., embed=True),
    chat_id: int = Path(..., description="The ID of the chat to send a message to")
):
    """
    Send a message in a chat.
    """
    try:
        # Get chat
        chat_result = supabase.table("chats").select("*, agents(*)").eq("id", chat_id).single().execute()
        
        if hasattr(chat_result, 'error') and chat_result.error:
            logger.error(f"Chat not found: {chat_result.error}")
            raise HTTPException(status_code=404, detail=f"Chat not found: {chat_result.error}")
        
        chat = chat_result.data
        
        # Get previous messages
        messages_result = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute()
        
        if hasattr(messages_result, 'error') and messages_result.error:
            logger.error(f"Error fetching messages: {messages_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching messages: {messages_result.error}")
        
        previous_messages = messages_result.data or []
        
        # Add user message to database
        user_message = {
            "chat_id": chat_id,
            "role": "user",
            "content": message
        }
        
        user_message_result = supabase.table("messages").insert(user_message).execute()
        
        if hasattr(user_message_result, 'error') and user_message_result.error:
            logger.error(f"Error saving user message: {user_message_result.error}")
            raise HTTPException(status_code=500, detail=f"Error saving user message: {user_message_result.error}")
        
        # Prepare messages for OpenAI API
        openai_messages = [{"role": msg["role"], "content": msg["content"]} for msg in previous_messages]
        openai_messages.append({"role": "user", "content": message})
        
        # Determine if this is a child agent and if we should include parent documents
        include_parent_docs = False
        include_child_agent_context = False
        
        if chat.get("agents"):
            agent_result = supabase.table("agents").select("parent_id, is_parent").eq("id", chat["agents"]["id"]).single().execute()
            
            if not hasattr(agent_result, 'error') and agent_result.data:
                agent = agent_result.data
                if agent.get("parent_id"):
                    # This is a child agent, so include parent documents
                    include_parent_docs = True
                
                if agent.get("is_parent"):
                    # This is a parent agent, so include context from child agents
                    include_child_agent_context = True
        
        logger.info(f"Processing message: '{message}' for chat {chat_id} with agent {chat['agents']['id']}")
        
        # Retrieve relevant chunks for the query
        logger.info(f"Retrieving relevant chunks for query: '{message}'")
        relevant_chunks = await retrieve_relevant_chunks(
            chat["agents"]["id"],
            message,
            5,  # Limit to 5 most relevant chunks
            include_parent_docs,
            include_child_agent_context
        )
        
        logger.info(f"Retrieved {len(relevant_chunks)} relevant chunks")
        
        # Format chunks as context
        document_context = format_chunks_as_context(relevant_chunks)
        
        # If this is a parent agent, retrieve child agent chat history
        child_chat_context = ""
        if include_child_agent_context:
            logger.info("Retrieving child agent chat history for parent agent context")
            child_chat_context = await retrieve_child_agent_chat_history(chat["agents"]["id"], limit=20)
            if child_chat_context:
                logger.info("Retrieved child agent chat history")
            else:
                logger.info("No child agent chat history found")
        
        # Combine all context
        all_context = ""
        if document_context:
            all_context += document_context
        if child_chat_context:
            all_context += format_chat_history_as_context(child_chat_context)
        
        # If we have any context, add it to the prompt
        if all_context:
            logger.info("Adding context to the prompt")
            
            # Find the system message
            system_message_index = next((i for i, msg in enumerate(openai_messages) if msg["role"] == "system"), None)
            
            if system_message_index is not None:
                # Add context to system message
                logger.info("Adding context to existing system message")
                openai_messages[system_message_index]["content"] += "\n\n" + all_context
            else:
                # If no system message exists, add one with the context
                logger.info("Creating new system message with context")
                openai_messages.insert(0, {
                    "role": "system",
                    "content": f"You are an AI assistant. {all_context}"
                })
        else:
            logger.info("No context to add to the prompt")
        
        # Use the safe_api_call helper to handle API errors gracefully
        completion = await safe_api_call(
            lambda: openai_client.chat.completions.create(
                model="gpt-4o",
                messages=openai_messages,
                temperature=0.7,
                max_tokens=4000,
            ),
            "I'm having trouble connecting to my knowledge base right now. Please try again later or ask a different question."
        )
        
        # Get assistant response
        assistant_response = completion.choices[0].message.content
        
        # Save assistant response to database
        assistant_message = {
            "chat_id": chat_id,
            "role": "assistant",
            "content": assistant_response
        }
        
        assistant_message_result = supabase.table("messages").insert(assistant_message).execute()
        
        if hasattr(assistant_message_result, 'error') and assistant_message_result.error:
            logger.error(f"Error saving assistant message: {assistant_message_result.error}")
            raise HTTPException(status_code=500, detail=f"Error saving assistant message: {assistant_message_result.error}")
        
        # Get all messages for this chat
        all_messages_result = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute()
        
        if hasattr(all_messages_result, 'error') and all_messages_result.error:
            logger.error(f"Error fetching all messages: {all_messages_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching all messages: {all_messages_result.error}")
        
        return {"success": True, "messages": all_messages_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        
        try:
            # Save error message to database
            error_message = {
                "chat_id": chat_id,
                "role": "assistant",
                "content": "I apologize, but I encountered an error processing your request. Please try again later."
            }
            
            supabase.table("messages").insert(error_message).execute()
        except Exception as db_error:
            logger.error(f"Error saving error message to database: {db_error}")
        
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")

@router.get("/{chat_id}/linked-chats", response_model=LinkedChatsResponse)
async def get_linked_chats(chat_id: int = Path(..., description="The ID of the chat")):
    """
    Get linked chats (parent and child chats).
    """
    try:
        # Get chat
        chat_result = supabase.table("chats").select("*, agents(*)").eq("id", chat_id).single().execute()
        
        if hasattr(chat_result, 'error') and chat_result.error:
            logger.error(f"Chat not found: {chat_result.error}")
            raise HTTPException(status_code=404, detail=f"Chat not found: {chat_result.error}")
        
        chat = chat_result.data
        
        # Get parent chat if this chat has a parent
        parent_chat = None
        if chat.get("parent_chat_id"):
            parent_chat_result = supabase.table("chats").select("*, agents(*)").eq("id", chat["parent_chat_id"]).single().execute()
            
            if not hasattr(parent_chat_result, 'error') and parent_chat_result.data:
                parent_chat = parent_chat_result.data
        
        # Get child chats
        child_chats_result = supabase.table("chats").select("*, agents(*)").eq("parent_chat_id", chat_id).execute()
        
        if hasattr(child_chats_result, 'error') and child_chats_result.error:
            logger.error(f"Error fetching child chats: {child_chats_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching child chats: {child_chats_result.error}")
        
        return {
            "success": True,
            "chat": chat,
            "parentChat": parent_chat,
            "childChats": child_chats_result.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching linked chats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agent/{agent_id}/chat-history", response_model=ChatHistoryResponse)
async def get_agent_chat_history(agent_id: int = Path(..., description="The ID of the agent")):
    """
    Get full chat history for an agent including child agent chats.
    """
    try:
        # Check if agent exists
        agent_result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
        
        if hasattr(agent_result, 'error') and agent_result.error:
            logger.error(f"Agent not found: {agent_result.error}")
            raise HTTPException(status_code=404, detail=f"Agent not found: {agent_result.error}")
        
        agent = agent_result.data
        
        # Get all chats for this agent
        agent_chats_result = supabase.table("chats").select("*").eq("agent_id", agent_id).order("created_at", desc=True).execute()
        
        if hasattr(agent_chats_result, 'error') and agent_chats_result.error:
            logger.error(f"Error fetching agent chats: {agent_chats_result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching agent chats: {agent_chats_result.error}")
        
        agent_chats = agent_chats_result.data or []
        
        # If this is a parent agent, get all child agents
        child_agent_chats = []
        if agent.get("is_parent"):
            # Get all child agents
            child_agents_result = supabase.table("agents").select("id").eq("parent_id", agent_id).execute()
            
            if not hasattr(child_agents_result, 'error') and child_agents_result.data:
                # Get chats for all child agents
                child_agent_ids = [a["id"] for a in child_agents_result.data]
                
                child_chats_result = supabase.table("chats").select("*").in_("agent_id", child_agent_ids).order("created_at", desc=True).execute()
                
                if not hasattr(child_chats_result, 'error') and child_chats_result.data:
                    child_agent_chats = child_chats_result.data
        
        # If this is a child agent, get the parent agent's chats
        parent_agent_chats = []
        if agent.get("parent_id"):
            parent_chats_result = supabase.table("chats").select("*").eq("agent_id", agent["parent_id"]).order("created_at", desc=True).execute()
            
            if not hasattr(parent_chats_result, 'error') and parent_chats_result.data:
                parent_agent_chats = parent_chats_result.data
        
        return {
            "success": True,
            "agent": agent,
            "agentChats": agent_chats,
            "childAgentChats": child_agent_chats,
            "parentAgentChats": parent_agent_chats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{chat_id}", response_model=ChatResponse)
async def delete_chat(chat_id: int = Path(..., description="The ID of the chat to delete")):
    """
    Delete a chat.
    """
    try:
        # Check if chat exists
        chat_result = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        
        if hasattr(chat_result, 'error') and chat_result.error:
            logger.error(f"Chat not found: {chat_result.error}")
            raise HTTPException(status_code=404, detail=f"Chat not found: {chat_result.error}")
        
        # Check if chat has child chats
        child_chats_result = supabase.table("chats").select("id").eq("parent_chat_id", chat_id).execute()
        
        if hasattr(child_chats_result, 'error') and child_chats_result.error:
            logger.error(f"Error checking child chats: {child_chats_result.error}")
            raise HTTPException(status_code=500, detail=f"Error checking child chats: {child_chats_result.error}")
        
        if child_chats_result.data:
            logger.error(f"Chat has child chats: {child_chats_result.data}")
            raise HTTPException(status_code=400, detail="Cannot delete chat with child chats")
        
        # Delete messages
        messages_result = supabase.table("messages").delete().eq("chat_id", chat_id).execute()
        
        if hasattr(messages_result, 'error') and messages_result.error:
            logger.error(f"Error deleting messages: {messages_result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting messages: {messages_result.error}")
        
        # Delete chat
        result = supabase.table("chats").delete().eq("id", chat_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error deleting chat: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting chat: {result.error}")
        
        return {"success": True, "chat": chat_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
