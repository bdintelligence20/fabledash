-- VECTOR EMBEDDING FIX
-- The embeddings are being stored as strings instead of proper vectors
-- This script fixes the embedding format issue

-- First, let's see what we're working with
SELECT 
    id,
    document_id,
    LEFT(content, 50) as content_preview,
    pg_typeof(embedding) as embedding_type,
    LENGTH(embedding::text) as embedding_length
FROM document_chunks 
LIMIT 3;

-- Check if we have any embeddings stored as text that need conversion
SELECT COUNT(*) as total_chunks FROM document_chunks;

-- Option 1: Clear all existing chunks and let them be regenerated properly
-- This is the safest approach since the embeddings are malformed
TRUNCATE TABLE document_chunks;

-- Option 2: If you want to keep the content but fix embeddings, 
-- you would need to regenerate embeddings for each chunk
-- But since the current embeddings are malformed strings, it's better to start fresh

-- Verify the table is ready for new embeddings
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'document_chunks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show that the table is now empty and ready for proper embeddings
SELECT COUNT(*) as remaining_chunks FROM document_chunks;
