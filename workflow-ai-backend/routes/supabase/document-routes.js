// Document routes for Supabase
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const pdf = require('pdf-parse');
const csvParser = require('csv-parser');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to extract text from PDF
async function extractTextFromPDF(buffer) {
  const data = await pdf(buffer);
  return data.text;
}

// Helper function to extract text from CSV
function extractTextFromCSV(buffer) {
  return new Promise((resolve, reject) => {
    // Create a temp file
    const tempPath = path.join(__dirname, '../../temp_' + Date.now() + '.csv');
    fs.writeFileSync(tempPath, buffer);
    
    let results = [];
    fs.createReadStream(tempPath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Clean up temp file
        fs.unlinkSync(tempPath);
        resolve(JSON.stringify(results, null, 2));
      })
      .on('error', (error) => {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(error);
      });
  });
}

// Helper function to extract text directly from file buffer
async function extractTextFromBuffer(buffer, mimeType, fileName) {
  if (mimeType.includes('pdf')) {
    return await extractTextFromPDF(buffer);
  } else if (mimeType.includes('csv')) {
    return await extractTextFromCSV(buffer);
  } else if (mimeType.includes('text') || path.extname(fileName) === '.txt') {
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

// Upload a document to an agent
router.post('/documents/upload', upload.single('file'), async (req, res) => {
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
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();
    
    if (agentError) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    
    // Create directory for this agent if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const agentDir = path.join(uploadsDir, agent_id.toString());
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    
    // Save file to disk
    const filename = Date.now() + '-' + file.originalname;
    const filePath = path.join(agentDir, filename);
    fs.writeFileSync(filePath, file.buffer);
    
    // Extract text from file
    const extractedText = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
    
    // Save document in database
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert([
        { agent_id, file_name: file.originalname, file_path: filePath }
      ])
      .select();
    
    if (documentError) {
      throw documentError;
    }
    
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
      const { error: chunkError } = await supabase
        .from('chunks')
        .insert([
          {
            document_id: document[0].id,
            agent_id,
            content: chunk,
            embedding: JSON.stringify(embedding),
            source: file.originalname
          }
        ]);
      
      if (chunkError) {
        throw chunkError;
      }
    }
    
    res.json({
      success: true,
      document: {
        id: document[0].id,
        agent_id: document[0].agent_id,
        file_name: document[0].file_name,
        created_at: document[0].created_at
      }
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ success: false, message: "Failed to upload document: " + error.message });
  }
});

// List documents for an agent
router.get('/documents/list', async (req, res) => {
  try {
    const { agent_id } = req.query;
    
    if (!agent_id) {
      return res.status(400).json({ success: false, message: "Agent ID is required" });
    }
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      documents: data.map(doc => ({
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

module.exports = router;
