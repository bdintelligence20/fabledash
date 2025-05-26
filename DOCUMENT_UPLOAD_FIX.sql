-- DOCUMENT UPLOAD FIX
-- This script fixes issues with the documents table structure
-- Run this in your Supabase SQL Editor

-- First, let's check the current structure of the documents table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Make filename and file_size nullable temporarily to allow existing records
ALTER TABLE documents ALTER COLUMN filename DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN file_size DROP NOT NULL;

-- Update any existing records with null values
UPDATE documents 
SET 
    filename = COALESCE(filename, 'unknown_file'),
    file_size = COALESCE(file_size, 0)
WHERE filename IS NULL OR file_size IS NULL;

-- Now make them NOT NULL again
ALTER TABLE documents ALTER COLUMN filename SET NOT NULL;
ALTER TABLE documents ALTER COLUMN file_size SET NOT NULL;

-- Verify the fix
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
LIMIT 10;
