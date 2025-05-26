-- FINAL DOCUMENT COLUMN FIX
-- You have both file_name and filename columns
-- This script consolidates them properly

-- First, let's see what we're working with
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND table_schema = 'public'
AND column_name IN ('file_name', 'filename')
ORDER BY column_name;

-- Copy data from filename to file_name if file_name is null
UPDATE documents 
SET file_name = filename 
WHERE file_name IS NULL AND filename IS NOT NULL;

-- Copy data from file_name to filename if filename is null  
UPDATE documents 
SET filename = file_name 
WHERE filename IS NULL AND file_name IS NOT NULL;

-- Set default values for any remaining nulls
UPDATE documents 
SET 
    file_name = COALESCE(file_name, 'unknown_file_' || id),
    filename = COALESCE(filename, 'unknown_file_' || id)
WHERE file_name IS NULL OR filename IS NULL;

-- Make both columns NOT NULL
ALTER TABLE documents ALTER COLUMN file_name SET NOT NULL;
ALTER TABLE documents ALTER COLUMN filename SET NOT NULL;

-- Option 1: Drop the file_name column and keep filename (RECOMMENDED)
-- Uncomment this if you want to use filename only:
-- ALTER TABLE documents DROP COLUMN file_name;

-- Option 2: Keep both columns synchronized with a trigger
-- This ensures both columns always have the same value
CREATE OR REPLACE FUNCTION sync_document_filename()
RETURNS TRIGGER AS $$
BEGIN
    -- If filename is updated, update file_name too
    IF NEW.filename IS DISTINCT FROM OLD.filename THEN
        NEW.file_name = NEW.filename;
    END IF;
    
    -- If file_name is updated, update filename too
    IF NEW.file_name IS DISTINCT FROM OLD.file_name THEN
        NEW.filename = NEW.file_name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep columns synchronized
DROP TRIGGER IF EXISTS sync_filename_trigger ON documents;
CREATE TRIGGER sync_filename_trigger
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION sync_document_filename();

-- Verify the fix
SELECT 
    id,
    agent_id,
    file_name,
    filename,
    file_type,
    file_size,
    created_at
FROM documents
ORDER BY created_at DESC
LIMIT 5;

-- Show column structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND table_schema = 'public'
AND column_name IN ('file_name', 'filename', 'file_size', 'file_type')
ORDER BY column_name;
