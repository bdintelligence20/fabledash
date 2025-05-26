-- FINAL EMBEDDING DEBUG
-- Check the actual data type of the embedding column

-- Check the column definition
SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'document_chunks' 
AND column_name = 'embedding'
AND table_schema = 'public';

-- Check if we have any data and what type it actually is
SELECT 
    id,
    document_id,
    pg_typeof(embedding) as embedding_type,
    LENGTH(embedding::text) as embedding_length,
    LEFT(embedding::text, 100) as embedding_preview
FROM document_chunks 
LIMIT 3;

-- If the column is TEXT instead of a proper array type, we need to change it
-- First backup any existing data (if any)
CREATE TABLE IF NOT EXISTS document_chunks_backup AS 
SELECT * FROM document_chunks;

-- Drop and recreate the embedding column with proper type
ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE document_chunks ADD COLUMN embedding FLOAT8[];

-- Verify the new column type
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_name = 'document_chunks' 
AND column_name = 'embedding'
AND table_schema = 'public';

-- Show that the table is ready for proper embeddings
SELECT COUNT(*) as total_chunks FROM document_chunks;
