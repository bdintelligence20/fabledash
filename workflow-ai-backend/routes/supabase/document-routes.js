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
    // Get parameters from body
    const { 
      agent_id, 
      file_data, 
      file_name, 
      content_type, 
      is_large_file = false,
      total_size,
      extracted_text
    } = req.body;
    
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
    
    // Generate a unique file path
    const timestamp = Date.now();
    const filePath = `agents/${agent_id}/${timestamp}-${file_name}`;
    
    // Upload file to Supabase Storage with chunking for large files
    let uploadData, uploadError;
    
    try {
      // Check if the bucket exists, create it if it doesn't
      const { data: buckets } = await supabase.storage.listBuckets();
      const documentsBucketExists = buckets.some(bucket => bucket.name === 'documents');
      
      if (!documentsBucketExists) {
        console.log("Creating 'documents' bucket in Supabase Storage");
        const { error: createBucketError } = await supabase.storage.createBucket('documents', {
          public: true
        });
        
        if (createBucketError) {
          console.error("Error creating bucket:", createBucketError);
          throw new Error(`Failed to create storage bucket: ${createBucketError.message}`);
        }
      }
      
      // For large files, we might need to handle them differently
      if (is_large_file && total_size > 10 * 1024 * 1024) {
        console.log(`Processing large file: ${file_name}, size: ${total_size} bytes`);
        
        // Upload the first chunk and let Supabase handle it
        ({ data: uploadData, error: uploadError } = await supabase
          .storage
          .from('documents')
          .upload(filePath, Buffer.from(fileData, 'base64'), {
            contentType: content_type || 'application/octet-stream',
            upsert: true // Changed to true to overwrite if exists
          }));
      } else {
        // Standard upload for smaller files
        ({ data: uploadData, error: uploadError } = await supabase
          .storage
          .from('documents')
          .upload(filePath, Buffer.from(fileData, 'base64'), {
            contentType: content_type || 'application/octet-stream',
            upsert: true // Changed to true to overwrite if exists
          }));
      }
    } catch (uploadErr) {
      console.error("Error during file upload:", uploadErr);
      throw new Error(`File upload failed: ${uploadErr.message}`);
    }
    
    if (uploadError) {
      throw new Error(`File upload failed: ${uploadError.message}`);
    }
    
    // Get public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('documents')
      .getPublicUrl(filePath);
    
    // Extract text from file or use the provided extracted_text
    let finalExtractedText;
    if (extracted_text && (content_type.includes('text') || file_name.endsWith('.txt') || file_name.endsWith('.csv'))) {
      // Use the text extracted on the client side for text files
      console.log("Using client-side extracted text");
      finalExtractedText = extracted_text;
    } else {
      // Extract text on the server side
      console.log("Extracting text on server side");
      finalExtractedText = await extractTextFromData(
        Buffer.from(fileData, 'base64'),
        content_type || 'application/octet-stream',
        file_name
      );
    }
    
    // Save document in database
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert([
        { 
          agent_id, 
          file_name, 
          file_path: filePath,
          content: finalExtractedText // Store the extracted text in the document record
        }
      ])
      .select();
    
    if (documentError) {
      throw documentError;
    }
    
    // Split text into chunks
    const chunks = splitTextIntoChunks(finalExtractedText);
    
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
          console.error(`Error storing chunk ${i}:`, chunkError);
        }
      } catch (embeddingError) {
        console.error(`Error generating embedding for chunk ${i}:`, embeddingError);
        // Continue processing other chunks even if one fails
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

// Delete a document
router.post('/documents/delete', async (req, res) => {
  try {
    const { document_id } = req.body;
    
    if (!document_id) {
      return res.status(400).json({ success: false, message: "Document ID is required" });
    }
    
    // Get document details first to get the agent_id and file_path
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();
    
    if (documentError) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    
    // Delete chunks associated with this document
    const { error: chunksError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', document_id);
    
    if (chunksError) {
      console.error("Error deleting chunks:", chunksError);
      // Continue with document deletion even if chunk deletion fails
    }
    
    // Delete the file from Supabase Storage if it exists
    if (document.file_path) {
      try {
        const { error: storageError } = await supabase
          .storage
          .from('documents')
          .remove([document.file_path]);
        
        if (storageError) {
          console.error("Error deleting file from storage:", storageError);
          // Continue with document deletion even if storage deletion fails
        }
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue with document deletion even if storage deletion fails
      }
    }
    
    // Delete the document from the database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', document_id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    res.json({
      success: true,
      message: "Document deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ success: false, message: "Failed to delete document: " + error.message });
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
