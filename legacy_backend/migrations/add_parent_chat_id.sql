-- Add parent_chat_id column to chats table
ALTER TABLE chats ADD COLUMN parent_chat_id INTEGER REFERENCES chats(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_chats_parent_chat_id ON chats(parent_chat_id);
