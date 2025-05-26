-- CHAT FOREIGN KEY FIX
-- The error shows duplicate foreign key relationships between chats and agents
-- This script removes the duplicate constraint

-- Check current foreign key constraints on chats table
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='chats'
AND tc.table_schema='public';

-- Drop the duplicate foreign key constraint
-- Keep the one created by our schema (chats_agent_id_fkey) and drop the other
DO $$
BEGIN
    -- Drop fk_chats_agent_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_chats_agent_id' 
               AND table_name = 'chats' 
               AND table_schema = 'public') THEN
        ALTER TABLE chats DROP CONSTRAINT fk_chats_agent_id;
        RAISE NOTICE 'Dropped duplicate foreign key constraint fk_chats_agent_id';
    END IF;
    
    -- Ensure the correct one exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chats_agent_id_fkey' 
                   AND table_name = 'chats' 
                   AND table_schema = 'public') THEN
        ALTER TABLE chats ADD CONSTRAINT chats_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added correct foreign key constraint chats_agent_id_fkey';
    END IF;
END $$;

-- Verify the fix - should only show one foreign key relationship now
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='chats'
AND tc.table_schema='public';
