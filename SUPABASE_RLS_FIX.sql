-- SUPABASE ROW LEVEL SECURITY FIX
-- This script fixes the RLS authentication issues
-- Run this in your Supabase SQL Editor

-- Temporarily disable RLS for development/testing
-- WARNING: This allows public access - only use for development!

-- Option 1: Disable RLS temporarily for testing (RECOMMENDED FOR DEVELOPMENT)
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments DISABLE ROW LEVEL SECURITY;

-- Option 2: Create more permissive policies (ALTERNATIVE)
-- Uncomment these if you want to keep RLS enabled but allow public access

/*
-- Drop existing policies
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON agents;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON chats;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON messages;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON documents;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON document_chunks;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON clients;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON task_statuses;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON tasks;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON task_comments;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON task_attachments;

-- Create permissive policies that allow public access
CREATE POLICY "Allow public access" ON agents FOR ALL USING (true);
CREATE POLICY "Allow public access" ON chats FOR ALL USING (true);
CREATE POLICY "Allow public access" ON messages FOR ALL USING (true);
CREATE POLICY "Allow public access" ON documents FOR ALL USING (true);
CREATE POLICY "Allow public access" ON document_chunks FOR ALL USING (true);
CREATE POLICY "Allow public access" ON clients FOR ALL USING (true);
CREATE POLICY "Allow public access" ON task_statuses FOR ALL USING (true);
CREATE POLICY "Allow public access" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public access" ON task_comments FOR ALL USING (true);
CREATE POLICY "Allow public access" ON task_attachments FOR ALL USING (true);
*/

-- Verify RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('agents', 'chats', 'messages', 'documents', 'document_chunks', 'clients', 'tasks', 'task_statuses', 'task_comments', 'task_attachments')
ORDER BY tablename;

-- Show current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
