from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import List, Optional
import logging
from datetime import date

from app.models.task import (
    Task, TaskCreate, TaskUpdate, TaskStatus, TaskStatusCreate,
    TaskComment, TaskCommentCreate, TaskAttachment,
    TaskResponse, TasksResponse, TaskStatusResponse, TaskStatusesResponse,
    TaskCommentResponse, TaskCommentsResponse, TaskAttachmentResponse,
    TaskAttachmentsResponse, TaskWithDetailsResponse
)
from app.utils.supabase_client import get_supabase_client

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Get Supabase client
supabase = get_supabase_client()

@router.get("/", response_model=TasksResponse)
async def get_tasks(
    client_id: Optional[int] = Query(None, description="Filter tasks by client ID"),
    status_id: Optional[int] = Query(None, description="Filter tasks by status ID"),
    due_date_from: Optional[date] = Query(None, description="Filter tasks by due date (from)"),
    due_date_to: Optional[date] = Query(None, description="Filter tasks by due date (to)")
):
    """
    Get all tasks, optionally filtered by client ID, status ID, and due date range.
    """
    try:
        query = supabase.table("tasks").select("*")
        
        if client_id is not None:
            query = query.eq("client_id", client_id)
        
        if status_id is not None:
            query = query.eq("status_id", status_id)
        
        if due_date_from is not None:
            query = query.gte("due_date", due_date_from.isoformat())
        
        if due_date_to is not None:
            query = query.lte("due_date", due_date_to.isoformat())
        
        result = query.order("due_date", desc=False).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching tasks: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching tasks: {result.error}")
        
        return {"success": True, "tasks": result.data}
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{task_id}", response_model=TaskWithDetailsResponse)
async def get_task(task_id: int = Path(..., description="The ID of the task to get")):
    """
    Get a specific task by ID with its status, comments, and attachments.
    """
    try:
        # Get task
        task_result = supabase.table("tasks").select("*").eq("id", task_id).single().execute()
        
        if hasattr(task_result, 'error') and task_result.error:
            logger.error(f"Task not found: {task_result.error}")
            raise HTTPException(status_code=404, detail=f"Task not found: {task_result.error}")
        
        task = task_result.data
        
        # Get status
        status_result = supabase.table("task_statuses").select("*").eq("id", task["status_id"]).single().execute()
        
        if hasattr(status_result, 'error') and status_result.error:
            logger.error(f"Status not found: {status_result.error}")
            # Continue anyway, not critical
            status = None
        else:
            status = status_result.data
        
        # Get comments
        comments_result = supabase.table("task_comments").select("*").eq("task_id", task_id).order("created_at").execute()
        
        if hasattr(comments_result, 'error') and comments_result.error:
            logger.error(f"Error fetching comments: {comments_result.error}")
            # Continue anyway, not critical
            comments = []
        else:
            comments = comments_result.data or []
        
        # Get attachments
        attachments_result = supabase.table("task_attachments").select("*").eq("task_id", task_id).order("created_at").execute()
        
        if hasattr(attachments_result, 'error') and attachments_result.error:
            logger.error(f"Error fetching attachments: {attachments_result.error}")
            # Continue anyway, not critical
            attachments = []
        else:
            attachments = attachments_result.data or []
        
        # Combine data
        task_with_details = {
            **task,
            "status": status,
            "comments": comments,
            "attachments": attachments
        }
        
        return {"success": True, "task": task_with_details}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    """
    Create a new task.
    """
    try:
        # Check if status exists
        status_result = supabase.table("task_statuses").select("*").eq("id", task.status_id).single().execute()
        
        if hasattr(status_result, 'error') and status_result.error:
            logger.error(f"Status not found: {status_result.error}")
            raise HTTPException(status_code=404, detail=f"Status not found: {status_result.error}")
        
        # Check if client exists (if provided)
        if task.client_id is not None:
            client_result = supabase.table("clients").select("*").eq("id", task.client_id).single().execute()
            
            if hasattr(client_result, 'error') and client_result.error:
                logger.error(f"Client not found: {client_result.error}")
                raise HTTPException(status_code=404, detail=f"Client not found: {client_result.error}")
        
        # Create task
        result = supabase.table("tasks").insert(task.dict()).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error creating task: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating task: {result.error}")
        
        return {"success": True, "task": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task: TaskUpdate,
    task_id: int = Path(..., description="The ID of the task to update")
):
    """
    Update an existing task.
    """
    try:
        # Check if task exists
        task_result = supabase.table("tasks").select("*").eq("id", task_id).single().execute()
        
        if hasattr(task_result, 'error') and task_result.error:
            logger.error(f"Task not found: {task_result.error}")
            raise HTTPException(status_code=404, detail=f"Task not found: {task_result.error}")
        
        # Check if status exists (if provided)
        if task.status_id is not None:
            status_result = supabase.table("task_statuses").select("*").eq("id", task.status_id).single().execute()
            
            if hasattr(status_result, 'error') and status_result.error:
                logger.error(f"Status not found: {status_result.error}")
                raise HTTPException(status_code=404, detail=f"Status not found: {status_result.error}")
        
        # Check if client exists (if provided)
        if task.client_id is not None:
            client_result = supabase.table("clients").select("*").eq("id", task.client_id).single().execute()
            
            if hasattr(client_result, 'error') and client_result.error:
                logger.error(f"Client not found: {client_result.error}")
                raise HTTPException(status_code=404, detail=f"Client not found: {client_result.error}")
        
        # Update task
        update_data = {k: v for k, v in task.dict().items() if v is not None}
        result = supabase.table("tasks").update(update_data).eq("id", task_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error updating task: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error updating task: {result.error}")
        
        return {"success": True, "task": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{task_id}", response_model=TaskResponse)
async def delete_task(task_id: int = Path(..., description="The ID of the task to delete")):
    """
    Delete a task.
    """
    try:
        # Check if task exists
        task_result = supabase.table("tasks").select("*").eq("id", task_id).single().execute()
        
        if hasattr(task_result, 'error') and task_result.error:
            logger.error(f"Task not found: {task_result.error}")
            raise HTTPException(status_code=404, detail=f"Task not found: {task_result.error}")
        
        # Delete task comments
        comments_result = supabase.table("task_comments").delete().eq("task_id", task_id).execute()
        
        if hasattr(comments_result, 'error') and comments_result.error:
            logger.error(f"Error deleting task comments: {comments_result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting task comments: {comments_result.error}")
        
        # Delete task attachments
        attachments_result = supabase.table("task_attachments").delete().eq("task_id", task_id).execute()
        
        if hasattr(attachments_result, 'error') and attachments_result.error:
            logger.error(f"Error deleting task attachments: {attachments_result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting task attachments: {attachments_result.error}")
        
        # Delete task
        result = supabase.table("tasks").delete().eq("id", task_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error deleting task: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting task: {result.error}")
        
        return {"success": True, "task": task_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Task Status Endpoints

@router.get("/statuses", response_model=TaskStatusesResponse)
async def get_task_statuses():
    """
    Get all task statuses.
    """
    try:
        result = supabase.table("task_statuses").select("*").order("id").execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching task statuses: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching task statuses: {result.error}")
        
        return {"success": True, "statuses": result.data}
    except Exception as e:
        logger.error(f"Error fetching task statuses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/statuses", response_model=TaskStatusResponse)
async def create_task_status(status: TaskStatusCreate):
    """
    Create a new task status.
    """
    try:
        result = supabase.table("task_statuses").insert(status.dict()).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error creating task status: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating task status: {result.error}")
        
        return {"success": True, "status": result.data[0]}
    except Exception as e:
        logger.error(f"Error creating task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Task Comment Endpoints

@router.get("/{task_id}/comments", response_model=TaskCommentsResponse)
async def get_task_comments(task_id: int = Path(..., description="The ID of the task")):
    """
    Get all comments for a task.
    """
    try:
        # Check if task exists
        task_result = supabase.table("tasks").select("id").eq("id", task_id).single().execute()
        
        if hasattr(task_result, 'error') and task_result.error:
            logger.error(f"Task not found: {task_result.error}")
            raise HTTPException(status_code=404, detail=f"Task not found: {task_result.error}")
        
        # Get comments
        result = supabase.table("task_comments").select("*").eq("task_id", task_id).order("created_at").execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error fetching task comments: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error fetching task comments: {result.error}")
        
        return {"success": True, "comments": result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching task comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{task_id}/comments", response_model=TaskCommentResponse)
async def create_task_comment(
    comment: TaskCommentCreate,
    task_id: int = Path(..., description="The ID of the task")
):
    """
    Create a new comment for a task.
    """
    try:
        # Check if task exists
        task_result = supabase.table("tasks").select("id").eq("id", task_id).single().execute()
        
        if hasattr(task_result, 'error') and task_result.error:
            logger.error(f"Task not found: {task_result.error}")
            raise HTTPException(status_code=404, detail=f"Task not found: {task_result.error}")
        
        # Create comment
        comment_data = comment.dict()
        comment_data["task_id"] = task_id
        
        result = supabase.table("task_comments").insert(comment_data).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error creating task comment: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error creating task comment: {result.error}")
        
        return {"success": True, "comment": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating task comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/comments/{comment_id}", response_model=TaskCommentResponse)
async def delete_task_comment(comment_id: int = Path(..., description="The ID of the comment to delete")):
    """
    Delete a task comment.
    """
    try:
        # Check if comment exists
        comment_result = supabase.table("task_comments").select("*").eq("id", comment_id).single().execute()
        
        if hasattr(comment_result, 'error') and comment_result.error:
            logger.error(f"Comment not found: {comment_result.error}")
            raise HTTPException(status_code=404, detail=f"Comment not found: {comment_result.error}")
        
        # Delete comment
        result = supabase.table("task_comments").delete().eq("id", comment_id).execute()
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error deleting task comment: {result.error}")
            raise HTTPException(status_code=500, detail=f"Error deleting task comment: {result.error}")
        
        return {"success": True, "comment": comment_result.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
