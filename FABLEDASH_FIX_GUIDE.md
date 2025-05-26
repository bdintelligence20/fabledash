# FableDash Complete Fix Guide

## URGENT: Follow these steps to fix your FableDash application

### Step 1: Fix Database Schema (CRITICAL)

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste the ENTIRE contents of `COMPLETE_FABLEDASH_DATABASE_FIX.sql`**
4. **Run the script**

This will:
- Create all missing tables (task_statuses, tasks, task_comments, task_attachments)
- Fix the documents table structure
- Add all required foreign keys and indexes
- Insert sample data for testing
- Set up proper security policies

### Step 2: Verify Database Setup

After running the SQL script, verify these tables exist in your Supabase database:
- ✅ clients
- ✅ agents  
- ✅ chats
- ✅ messages
- ✅ documents
- ✅ document_chunks
- ✅ tasks
- ✅ task_statuses
- ✅ task_comments
- ✅ task_attachments

### Step 3: Environment Variables

Ensure your environment variables are properly set:

**Backend (.env in python-backend/):**
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=https://fabledash-frontend-73351471156.us-central1.run.app,http://localhost:3000,http://localhost:5173
```

**Frontend (.env in root/):**
```
VITE_API_URL=https://fabledash-backend-73351471156.us-central1.run.app
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 4: Test Backend API

1. **Start the Python backend:**
```bash
cd python-backend
python server.py
```

2. **Test these endpoints:**
- GET http://localhost:8000/health
- GET http://localhost:8000/clients
- GET http://localhost:8000/agents
- GET http://localhost:8000/tasks
- GET http://localhost:8000/task-statuses

### Step 5: Test Frontend

1. **Start the frontend:**
```bash
npm run dev
```

2. **Test these pages:**
- Dashboard: http://localhost:3000/
- Clients: http://localhost:3000/clients
- Tasks: http://localhost:3000/tasks
- AI Agents: http://localhost:3000/agents

### Step 6: Deploy to Production

1. **Deploy Backend:**
```bash
gcloud builds submit --config backend-cloudbuild.yaml python-backend/
```

2. **Deploy Frontend:**
```bash
gcloud builds submit --config frontend-cloudbuild.yaml .
```

## Expected Functionality After Fix

### ✅ Dashboard Page
- View business metrics and KPIs
- Banking information display
- Sales history charts
- Top customers list

### ✅ Client Management
- Create, read, update, delete clients
- View client details
- Associate agents with clients
- Kanban and calendar views

### ✅ Task Management
- Create tasks with titles, descriptions, due dates
- Assign tasks to clients
- Track task status (To Do, In Progress, Review, Done)
- Add comments to tasks
- Attach files to tasks
- Filter tasks by various criteria

### ✅ AI Agent System
- Create specialized AI agents
- Parent-child agent relationships
- Chat with agents
- Upload documents for RAG
- Share knowledge between agents

### ✅ Document Intelligence
- Upload PDF, DOCX, TXT files
- Automatic text extraction and chunking
- Vector embeddings for similarity search
- Context-aware AI responses

## Troubleshooting

### Database Issues
- If tables don't exist, re-run the SQL script
- Check Supabase logs for errors
- Verify RLS policies are enabled

### API Connection Issues
- Check CORS settings in backend
- Verify API URLs in frontend
- Check network connectivity

### Authentication Issues
- Verify Supabase keys are correct
- Check RLS policies allow access
- Ensure authenticated user exists

## Testing Checklist

- [ ] Database schema is complete
- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] Can create/view clients
- [ ] Can create/view tasks
- [ ] Can create/view agents
- [ ] Can chat with agents
- [ ] Can upload documents
- [ ] Dashboard displays data

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check backend logs for API errors
3. Verify database connections
4. Ensure all environment variables are set
5. Test API endpoints directly

The application should now be fully functional with all features described in the comprehensive description!
