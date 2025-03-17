// Document routes for Supabase
const express = require('express');
const { OpenAI } = require('openai');
const pdf = require('pdf-parse');
const router = express.Router();
const { Readable } = require('stream');
const { Buffer } = require('buffer');

// Import the Supabase client
const supabase = require('../../supabase');

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
});

// Helper function to extract text from PDF
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return "Error extracting text from PDF";
  }
}

// Helper function to extract text from CSV
function extractTextFromCSV(csvString) {
  try {
    // Simple CSV parsing without file system operations
    const lines = csvString.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(value => value.trim());
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      results.push(row);
    }
    
    return JSON.stringify(results, null, 2);
  } catch (error) {
    console.error("Error parsing CSV:", error);
    return "Error parsing CSV data";
  }
}

// Helper function to extract text from file data
async function extractTextFromData(data, contentType, fileName) {
  try {
    // Convert base64 to buffer if needed
    let buffer;
    if (typeof data === 'string' && data.startsWith('data:')) {
      const base64Data = data.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (typeof data === 'string') {
      buffer = Buffer.from(data);
    } else {
      throw new Error("Unsupported data format");
    }
    
    if (contentType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      return await extractTextFromPDF(buffer);
    } else if (contentType.includes('csv') || fileName.toLowerCase().endsWith('.csv')) {
      return extractTextFromCSV(buffer.toString('utf8'));
    } else if (contentType.includes('text') || 
               fileName.toLowerCase().endsWith('.txt') || 
               fileName.toLowerCase().endsWith('.md')) {
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
  } catch (error) {
    console.error("Error in extractTextFromData:", error);
    return "Error extracting text from file";
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
router.post('/documents/upload', async (req, res) => {
  try {
    // Get agent_id from body
    const { agent_id, file_data, file_name, content_type } = req.body;
    
    if (!agent_id) {
      return res.status(400).json({ success: false, message: "Agent ID is required" });
    }
    
    if (!file_data || !file_name) {
      return res.status(400).json({ success: false, message: "File data and file name are required" });
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
    
    // Extract the base64 data if it's a data URL
    let fileData = file_data;
    if (typeof file_data === 'string' && file_data.startsWith('data:')) {
      fileData = file_data.split(',')[1];
    }
    
    // Upload file to Supabase Storage
    const filePath = `agents/${agent_id}/${Date.now()}-${file_name}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(filePath, Buffer.from(fileData, 'base64'), {
        contentType: content_type || 'application/octet-stream',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`File upload failed: ${uploadError.message}`);
    }
    
    // Get public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('documents')
      .getPublicUrl(filePath);
    
    // Extract text from file
    const extractedText = await extractTextFromData(
      Buffer.from(fileData, 'base64'),
      content_type || 'application/octet-stream',
      file_name
    );
    
    // Save document in database
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert([
        { 
          agent_id, 
          file_name, 
          file_path: filePath,
          content: extractedText // Store the extracted text in the document record
        }
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
            embedding: embedding,
            source: file_name
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
        created_at: document[0].created_at,
        url: publicUrl
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
