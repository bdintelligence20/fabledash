# DEPLOY BACKEND FIX

## CRITICAL: Backend Code Fix Applied

I've fixed the source code issue in `python-backend/app/api/documents.py`:

**The Problem:** The API was only inserting `filename` but the database expected both `filename` AND `file_name`.

**The Fix:** Added `"file_name": filename` to the document_data dictionary so both columns are populated.

## IMMEDIATE DEPLOYMENT REQUIRED

You need to redeploy the backend to apply this fix:

```bash
# Deploy the updated backend to Google Cloud Run
gcloud builds submit --config backend-cloudbuild.yaml python-backend/
```

## COMPLETE FIX SEQUENCE

1. **✅ Database Fixes** (Run these SQL scripts in Supabase):
   - `COMPLETE_FABLEDASH_DATABASE_FIX.sql`
   - `SUPABASE_RLS_FIX.sql` 
   - `FINAL_DOCUMENT_COLUMN_FIX.sql`

2. **✅ Backend Code Fix** (DONE - Applied to source code):
   - Fixed `python-backend/app/api/documents.py` to include both `filename` and `file_name`

3. **🔄 DEPLOY BACKEND** (DO THIS NOW):
   ```bash
   gcloud builds submit --config backend-cloudbuild.yaml python-backend/
   ```

## AFTER DEPLOYMENT

Your document upload will work properly:
- ✅ Files upload successfully
- ✅ Documents are processed and chunked
- ✅ AI agents can access document knowledge
- ✅ RAG system functions completely

## VERIFICATION

After deployment, test:
1. Upload a PDF/DOCX document to an agent
2. Verify it appears in the agent's documents list
3. Chat with the agent about the document content
4. Confirm the agent can reference the document in responses

**The application will be fully functional after this deployment!**
