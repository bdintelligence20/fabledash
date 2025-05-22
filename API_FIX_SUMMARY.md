# FableDash API Fix Summary

## Issues Fixed

We've addressed two main issues with your FableDash application:

### 1. API Path Mismatch

**Problem**: The frontend was making requests to paths like `/clients`, `/tasks`, and `/task-statuses`, but the backend routes were configured with an `/api` prefix (e.g., `/api/clients`).

**Solution**: We modified the backend routes in `python-backend/app/main.py` to remove the `/api` prefix:

```python
# Changed from:
app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
app.include_router(chats_router, prefix="/api/chats", tags=["chats"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(clients_router, prefix="/api/clients", tags=["clients"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])

# Changed to:
app.include_router(agents_router, prefix="/agents", tags=["agents"])
app.include_router(chats_router, prefix="/chats", tags=["chats"])
app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(clients_router, prefix="/clients", tags=["clients"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
```

We also added a direct endpoint for `/task-statuses` to match what the frontend is expecting:

```python
@app.get("/task-statuses", tags=["task-statuses"])
async def get_task_statuses():
    """
    Get all task statuses - direct endpoint for frontend compatibility.
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
```

Additionally, we updated the CORS settings to specifically allow your frontend domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fabledash-frontend-73351471156.us-central1.run.app",
        # Keep localhost for development
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Mixed Content Error (HTTP vs HTTPS)

**Problem**: The frontend is being served over HTTPS, but it's trying to access the backend API over HTTP, causing mixed content errors in the browser.

**Solution**: You need to update the `_API_URL` environment variable in your Cloud Build trigger to use HTTPS instead of HTTP. See the `HTTPS_FIX.md` file for detailed instructions.

## Deployment Steps

To deploy these changes:

1. **Update the Cloud Build Service Account Permissions**:
   - Go to IAM & Admin > IAM in the Google Cloud Console
   - Find the Cloud Build service account (`73351471156-compute@developer.gserviceaccount.com`)
   - Click the pencil icon to edit the permissions
   - Click "Add another role" and add the "Security Admin" role
   - Click "Save"

2. **Update the API URL in the Frontend Cloud Build Trigger**:
   - Go to Cloud Build > Triggers
   - Find your frontend trigger
   - Click on the trigger to edit it
   - Scroll down to the Substitution variables section
   - Update the `_API_URL` variable to use HTTPS:
     ```
     _API_URL: https://fabledash-backend-73351471156.us-central1.run.app
     ```
   - Click Save

3. **Deploy the Backend**:
   - Trigger a new backend build
   - This will deploy the updated backend with the fixed API paths

4. **Deploy the Frontend**:
   - After the backend is successfully deployed, trigger a new frontend build
   - This will deploy the frontend with the correct HTTPS API URL

## Verification

After deployment, verify that:

1. The backend API endpoints are accessible:
   - `https://fabledash-backend-73351471156.us-central1.run.app/health`
   - `https://fabledash-backend-73351471156.us-central1.run.app/clients`
   - `https://fabledash-backend-73351471156.us-central1.run.app/task-statuses`
   - `https://fabledash-backend-73351471156.us-central1.run.app/agents`

2. The frontend can connect to the backend without any mixed content errors.

## Future Considerations

1. **Add a Fallback in Your Code**:
   ```javascript
   // In your API utility file or component
   const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
   
   // Ensure HTTPS is used in production
   const secureApiUrl = apiUrl.replace(/^http:\/\//i, 'https://');
   ```

2. **Consider Using a Base API Client**:
   Create a centralized API client that handles all requests and ensures HTTPS is used in production.

3. **Environment-Specific Configuration**:
   Consider using different configuration files for development and production to avoid these issues in the future.
