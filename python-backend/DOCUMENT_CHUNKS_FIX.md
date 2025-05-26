# Document Chunks Table Fix

## Issue Description

You may encounter the following issues related to the missing `document_chunks` table:

1. **Chat Error**: When trying to start a chat with a child agent:
```
Error retrieving relevant chunks: {'code': '42P01', 'details': None, 'hint': None, 'message': 'relation "public.document_chunks" does not exist'}
```

2. **Document Upload Error**: When trying to upload documents, you may encounter:
   - 405 (Method Not Allowed) error
   - 500 error with message: `Could not find the 'content_type' column of 'documents'`
   - Upload fails during processing

These errors occur because:
1. The `document_chunks` table is missing from your Supabase database
2. The `documents` table is missing required columns (`content_type`, `file_size`, `file_type`, `updated_at`)

These components are required for the RAG (Retrieval Augmented Generation) system and document management.

## Solution

### Option 1: Fix Documents Table First (If getting content_type errors)

If you're getting `Could not find the 'content_type' column` errors:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `python-backend/scripts/fix_documents_table.sql`
4. Run the SQL script

### Option 2: Create Document Chunks Table

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `python-backend/scripts/create_document_chunks_table.sql`
4. Run the SQL script

### Option 3: Apply the Complete Schema (Comprehensive Fix)

If you want to ensure all tables are properly created with all required columns:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `python-backend/supabase-schema.sql`
4. Run the SQL script

**Note:** This will create all tables if they don't exist, but won't affect existing data.

## What the Fix Does

The fix creates the following:

1. **document_chunks table** - Stores text chunks from uploaded documents with their embeddings
2. **Indexes** - For efficient querying and vector similarity search
3. **Row Level Security (RLS)** - Ensures proper access control
4. **Policies** - Allows authenticated users to access the table

## Code Changes Made

### Document Processor Service (`python-backend/app/services/document_processor.py`)

1. **Gracefully handle missing table** - Instead of crashing, it now returns an empty chunks list
2. **Check table existence** - Verifies the table exists before attempting queries
3. **Log warnings** - Provides clear logging when the table is missing
4. **Document processing** - Handles missing table during document upload processing

### Documents API (`python-backend/app/api/documents.py`)

1. **Added `/formdata` endpoint** - Provides alternative upload endpoint for frontend compatibility
2. **Graceful chunk deletion** - Handles missing table when deleting documents
3. **Error handling** - Prevents upload failures when RAG processing isn't available

## Verification

After running the SQL script, you can verify the table was created by:

1. Going to the Table Editor in your Supabase dashboard
2. Looking for the `document_chunks` table
3. Or running this query in the SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'document_chunks';
```

## Testing

Once the table is created, try starting a chat with a child agent again. The error should be resolved, and the chat should work normally even if no documents have been uploaded yet.

## Future Document Uploads

When you upload documents to agents in the future, they will be processed and stored in the `document_chunks` table, enabling the RAG system to provide relevant context during conversations.
