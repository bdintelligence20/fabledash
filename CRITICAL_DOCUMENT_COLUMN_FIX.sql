-- CRITICAL DOCUMENT COLUMN FIX
-- The error shows column "file_name" but API uses "filename"
-- This script fixes the column name mismatch

-- Check current column names in documents table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Option 1: If column is named "file_name", rename it to "filename"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_name' AND table_schema = 'public') THEN
        ALTER TABLE documents RENAME COLUMN file_name TO filename;
        RAISE NOTICE 'Renamed file_name to filename';
    END IF;
END $$;

-- Option 2: If column doesn't exist, add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'filename' AND table_schema = 'public') THEN
        ALTER TABLE documents ADD COLUMN filename TEXT;
        RAISE NOTICE 'Added filename column';
    END IF;
END $$;

-- Update any null filenames with a default value
UPDATE documents 
SET filename = COALESCE(filename, 'unknown_file_' || id || '.pdf')
WHERE filename IS NULL;

-- Make filename NOT NULL
ALTER TABLE documents ALTER COLUMN filename SET NOT NULL;

-- Verify the fix
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND table_schema = 'public'
AND column_name IN ('filename', 'file_name', 'file_size', 'file_type')
ORDER BY column_name;

-- Show current documents
SELECT 
    id,
    agent_id,
    filename,
    file_type,
    file_size,
    content_type,
    created_at
FROM documents
ORDER BY created_at DESC
LIMIT 5;
