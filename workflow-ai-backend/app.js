// app.js - Main application file
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const pdf = require('pdf-parse');
const csvParser = require('csv-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Update this near the top of app.js
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make db available to routes
app.use((req, res, next) => {
  req.app.locals.db = db;
  next();
});

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
});

// Use memory storage instead of disk storage to avoid path issues
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Import routes
const clientTaskRoutes = require('./routes/client-task-routes');

// Use routes
app.use('/api', clientTaskRoutes);

// Initialize SQLite database
let db;
async function initDatabase() {
  // Create database directory if it doesn't exist
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: path.join(dbDir, 'workflow.db'),
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
      file_path TEXT NOT NULL,
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

  // Initialize client and task tables
  const clientTaskSchemaPath = path.join(__dirname, 'client-task-schema.sql');
  if (fs.existsSync(clientTaskSchemaPath)) {
    const clientTaskSchema = fs.readFileSync(clientTaskSchemaPath, 'utf8');
    await db.exec(clientTaskSchema);
    console.log('Client and task tables initialized');
  }

  console.log('Database initialized');
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper function to extract text from PDF
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

// Helper function to extract text from CSV
function extractTextFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    let results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(JSON.stringify(results, null, 2));
      })
      .on('error', reject);
  });
}

// Helper function to extract text directly from file buffer
async function extractTextFromBuffer(buffer, mimeType, filePath = null) {
  if (mimeType.includes('pdf')) {
    const data = await pdf(buffer);
    return data.text;
  } else if (mimeType.includes('csv')) {
    // For CSVs, we need to write to disk temporarily
    if (filePath) {
      return extractTextFromCSV(filePath);
    } else {
      // Create a temp file
      const tempPath = path.join(__dirname, 'temp_' + Date.now() + '.csv');
      fs.writeFileSync(tempPath, buffer);
      const result = await extractTextFromCSV(tempPath);
      // Clean up temp file
      fs.unlinkSync(tempPath);
      return result;
    }
  } else if (mimeType.includes('text') || (filePath && path.extname(filePath) === '.txt')) {
    return buffer.toString('utf8');
  } else {
    // Default: try to read as text
    try {
      return buffer.toString('utf8');
    } catch (error) {
      console.error("Failed to extract text:", error);
      return "Unable to extract text from this file type.";
    }
  }
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

// Endpoint to upload a document to an agent - COMPLETELY REWRITTEN VERSION
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
    
    // Create directory for this agent if it doesn't exist
    const agentDir = path.join(__dirname, 'uploads', agent_id.toString());
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    
    // Save file to disk
    const filename = Date.now() + '-' + file.originalname;
    const filePath = path.join(agentDir, filename);
    fs.writeFileSync(filePath, file.buffer);
    
    // Extract text from file
    const extractedText = await extractTextFromBuffer(file.buffer, file.mimetype, filePath);
    
    // Save document in database
    const result = await db.run(
      'INSERT INTO documents (agent_id, file_name, file_path) VALUES (?, ?, ?)',
      [agent_id, file.originalname, filePath]
    );
    
    const document = await db.get('SELECT * FROM documents WHERE id = ?', result.lastID);
    
    // Split text into chunks
    const chunks = splitTextIntoChunks(extractedText);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
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

// Update this function in your app.js file to improve chat generation quality

// Endpoint to send a message in a chat - IMPROVED VERSION
// Update this function in your app.js file to use the o3-mini-2025-01-31 model

// Endpoint to send a message in a chat - USING o3-mini-2025-01-31
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
    
    // Get embedding for the message with more dimensions
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message
    });
    
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    
    // Get all chunks for this agent
    const chunks = await db.all(
      'SELECT * FROM chunks WHERE agent_id = ?',
      chat.agent_id
    );
    
    // Calculate similarity and find the most relevant chunks
    const scoredChunks = chunks.map(chunk => {
      const embedding = JSON.parse(chunk.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        ...chunk,
        similarity
      };
    });
    
    // Sort by similarity and take top 10
    const topChunks = scoredChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
    
    // Build context from top chunks with source information
    let context = "";
    if (topChunks && topChunks.length > 0) {
      context = topChunks.map((chunk, index) => 
        `[Document ${index + 1}] ${chunk.content}\nSource: ${chunk.source} (Relevance: ${(chunk.similarity * 100).toFixed(1)}%)`
      ).join("\n\n");
    }
    
    // Build conversation messages including system prompt and previous messages
    const conversationMessages = [
      {
        role: "system",
        content: `You are ${agent.name}, an intelligent AI assistant specialized in providing accurate information based on provided documents. ${agent.description || ""}
        
Your task is to give helpful, accurate, and thoughtful answers based ONLY on the context provided below. If you're unsure or the answer isn't contained in the provided context, be honest and say "I don't have enough information about that in my knowledge base." Don't make up information that isn't supported by the documents.

When referring to information, cite the source (Document number) when possible.

Here is the relevant information from the knowledge base:
${context}

Remember: Be concise yet thorough. Prioritize accuracy over speculation. Structure complex answers with headings and bullet points when helpful.`
      }
    ];
    
    // Add previous messages for conversation context (up to last 6 messages)
    const recentMessages = previousMessages.slice(-6);
    conversationMessages.push(...recentMessages);
    
    // Generate AI response with the specified model and parameters
    const completion = await openai.chat.completions.create({
      model: "o3-mini-2025-01-31",
      messages: conversationMessages,
      response_format: {
        "type": "text"
      },
      reasoning_effort: "medium"
    });
    
    const aiResponse = completion.choices[0].message.content;
    
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

// Initialize database and start server
(async () => {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
})();

module.exports = app;
