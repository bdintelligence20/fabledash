// vercel-app.js - Modified for Vercel serverless environment
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize in-memory SQLite database
let db;
async function initDatabase() {
  db = await open({
    filename: ':memory:', // Use in-memory database for Vercel
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
    );
  `);

  console.log('In-memory database initialized');
  
  // Add some sample data for testing
  await db.run(
    'INSERT INTO agents (name, description) VALUES (?, ?)',
    ['Sample Agent', 'This is a sample agent for testing purposes']
  );
}

// Helper function to split text into chunks
function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.length === 0) return [];
  
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex));
    startIndex += chunkSize - overlap;
    if (startIndex >= text.length) break;
    if (startIndex < 0) startIndex = 0; // Safety check
  }
  
  return chunks;
}

// Helper function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Endpoint to create a new agent
app.post('/api/agents/create', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Agent name is required" });
    }
    
    const result = await db.run(
      'INSERT INTO agents (name, description) VALUES (?, ?)',
      [name, description || '']
    );
    
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        created_at: agent.created_at
      }
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ success: false, message: "Failed to create agent" });
  }
});

// Endpoint to list all agents
app.get('/api/agents/list', async (req, res) => {
  try {
    const agents = await db.all('SELECT * FROM agents ORDER BY created_at DESC');
    
    res.json({
      success: true,
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        created_at: agent.created_at
      }))
    });
  } catch (error) {
    console.error("Error listing agents:", error);
    res.status(500).json({ success: false, message: "Failed to list agents" });
  }
});

// Simplified document upload for Vercel (stores content directly in DB)
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    // Get agent_id from body or query params
    const agent_id = req.body.agent_id || req.query.agent_id;
    
    if (!agent_id) {
      return res.status(400).json({ success: false, message: "Agent ID is required" });
    }
    
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    
    // Verify agent exists
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', agent_id);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    
    // Extract text from file buffer
    const fileContent = file.buffer.toString('utf8');
    
    // Save document in database with content
    const result = await db.run(
      'INSERT INTO documents (agent_id, file_name, content) VALUES (?, ?, ?)',
      [agent_id, file.originalname, fileContent]
    );
    
    const document = await db.get('SELECT * FROM documents WHERE id = ?', result.lastID);
    
    // Split text into chunks
    const chunks = splitTextIntoChunks(fileContent);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Get embedding from OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk
        });
        
        const embedding = embeddingResponse.data[0].embedding;
        
        // Store chunk and embedding in database
        await db.run(
          'INSERT INTO chunks (document_id, agent_id, content, embedding, source) VALUES (?, ?, ?, ?, ?)',
          [
            document.id,
            agent_id,
            chunk,
            JSON.stringify(embedding),
            file.originalname
          ]
        );
      } catch (embeddingError) {
        console.error("Error creating embedding:", embeddingError);
        // Continue with other chunks even if one fails
      }
    }
    
    res.json({
      success: true,
      document: {
        id: document.id,
        agent_id: document.agent_id,
        file_name: document.file_name,
        created_at: document.created_at
      }
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ success: false, message: "Failed to upload document: " + error.message });
  }
});

// Endpoint to list documents for an agent
app.get('/api/documents/list', async (req, res) => {
  try {
    const { agent_id } = req.query;
    
    if (!agent_id) {
      return res.status(400).json({ success: false, message: "Agent ID is required" });
    }
    
    const documents = await db.all(
      'SELECT * FROM documents WHERE agent_id = ? ORDER BY created_at DESC',
      agent_id
    );
    
    res.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        agent_id: doc.agent_id,
        file_name: doc.file_name,
        created_at: doc.created_at
      }))
    });
  } catch (error) {
    console.error("Error listing documents:", error);
    res.status(500).json({ success: false, message: "Failed to list documents" });
  }
});

// Endpoint to create a new chat
app.post('/api/chats/create', async (req, res) => {
  try {
    const { agent_id } = req.body;
    
    if (!agent_id) {
      return res.status(400).json({ success: false, message: "Agent ID is required" });
    }
    
    // Verify agent exists
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', agent_id);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    
    const result = await db.run(
      'INSERT INTO chats (agent_id) VALUES (?)',
      agent_id
    );
    
    const chat = await db.get('SELECT * FROM chats WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      chat: {
        id: chat.id,
        agent_id: chat.agent_id,
        created_at: chat.created_at
      }
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ success: false, message: "Failed to create chat" });
  }
});

// Endpoint to get chat details
app.get('/api/chats/details', async (req, res) => {
  try {
    const { chat_id } = req.query;
    
    if (!chat_id) {
      return res.status(400).json({ success: false, message: "Chat ID is required" });
    }
    
    const chat = await db.get('SELECT * FROM chats WHERE id = ?', chat_id);
    
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    
    res.json({
      success: true,
      chat: {
        id: chat.id,
        agent_id: chat.agent_id,
        created_at: chat.created_at
      }
    });
  } catch (error) {
    console.error("Error getting chat details:", error);
    res.status(500).json({ success: false, message: "Failed to get chat details" });
  }
});

// Simplified message endpoint for Vercel
app.post('/api/chats/message', async (req, res) => {
  try {
    const { chat_id, message } = req.body;
    
    if (!chat_id || !message) {
      return res.status(400).json({ success: false, message: "Chat ID and message are required" });
    }
    
    // Get chat details
    const chat = await db.get('SELECT * FROM chats WHERE id = ?', chat_id);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    
    // Get agent details
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', chat.agent_id);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    
    // Store user message
    await db.run(
      'INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)',
      [chat_id, 'user', message]
    );
    
    // Get chat history for better context
    const chatHistory = await db.all(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 10',
      chat_id
    );
    
    // Format previous messages for context
    const previousMessages = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Simplified response for Vercel (without embeddings)
    const aiResponse = "This is a simplified response from the AI assistant. The full functionality with embeddings and document search is not available in the serverless environment.";
    
    // Store AI response
    await db.run(
      'INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)',
      [chat_id, 'assistant', aiResponse]
    );
    
    // Get all messages for this chat
    const messages = await db.all(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC',
      chat_id
    );
    
    res.json({
      success: true,
      message: aiResponse,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
      }))
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: "Failed to send message: " + error.message });
  }
});

// Endpoint to get chat history
app.get('/api/chats/history', async (req, res) => {
  try {
    const { chat_id } = req.query;
    
    if (!chat_id) {
      return res.status(400).json({ success: false, message: "Chat ID is required" });
    }
    
    const messages = await db.all(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC',
      chat_id
    );
    
    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
      }))
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({ success: false, message: "Failed to get chat history" });
  }
});

// Initialize database for each request (since Vercel functions are stateless)
app.use(async (req, res, next) => {
  if (!db) {
    try {
      await initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return res.status(500).json({ success: false, message: "Failed to initialize database" });
    }
  }
  next();
});

// Export the Express app for Vercel
module.exports = app;
