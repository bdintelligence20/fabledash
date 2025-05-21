// api/documents.js - Serverless function for handling document uploads with proper CORS
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const supabase = require('../supabase');
const documentProcessor = require('../routes/supabase/document-processor');
const { v4: uuidv4 } = require('uuid');

// Create Express app
const app = express();

// CORS configuration with specific origins
app.use(cors({
  origin: ['https://fabledash.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add CORS headers to all responses as a fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://fabledash.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Configure body parser with increased limits
app.use(bodyParser.json({ limit: '1gb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1gb' }));

// Upload a document
app.post('/', async (req, res) => {
  try {
    console.log('Document upload request received');
    
    const { agent_id, file_data, file_name, content_type, extracted_text } = req.body;
    
    if (!agent_id || !file_data || !file_name) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID, file data, and file name are required'
      });
    }
    
    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();
    
    if (agentError || !agent) {
      console.error('Error fetching agent:', agentError);
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    // Extract base64 data
    const base64Data = file_data.split(';base64,').pop();
    
    // Generate a unique file name
    const uniqueFileName = `${uuidv4()}-${file_name}`;
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`${agent_id}/${uniqueFileName}`, Buffer.from(base64Data, 'base64'), {
        contentType: content_type || 'application/octet-stream',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage',
        error: uploadError.message
      });
    }
    
    // Get public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(`${agent_id}/${uniqueFileName}`);
    
    const publicUrl = publicUrlData?.publicUrl || '';
    
    // Create document record in database
    const documentData = {
      agent_id,
      file_name,
      file_type: content_type || 'application/octet-stream',
      file_path: uploadData.path,
      file_url: publicUrl,
      extracted_text: extracted_text || null,
    };
    
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single();
    
    if (documentError) {
      console.error('Error creating document record:', documentError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create document record',
        error: documentError.message
      });
    }
    
    // Process the document in the background
    // This will extract text, chunk it, and generate embeddings
    if (extracted_text) {
      // If extracted text was provided, process it directly
      documentProcessor.processDocument(document, extracted_text)
        .then(success => {
          if (success) {
            console.log(`Document ${document.id} processed successfully`);
          } else {
            console.error(`Failed to process document ${document.id}`);
          }
        })
        .catch(error => {
          console.error(`Error processing document ${document.id}:`, error);
        });
    } else {
      // Try to extract text from the file based on its type
      try {
        // Get the file from storage
        const { data: fileData, error: fileError } = await supabase.storage
          .from('documents')
          .download(document.file_path);
        
        if (fileError) {
          console.error('Error downloading file from storage:', fileError);
        } else {
          // Log the type of fileData for debugging
          console.log(`File data type: ${typeof fileData}, is Buffer: ${Buffer.isBuffer(fileData)}`);
          
          // For PDF files, try to use the public URL instead of the binary data
          if (document.file_type.includes('pdf') && document.file_url) {
            console.log(`Using public URL for PDF: ${document.file_url}`);
            
            // Extract text from the file using the URL
            const extractedText = await documentProcessor.extractTextFromDocumentUrl(
              document.file_url,
              document.file_type,
              document.file_name
            );
            
            // Process the document with the extracted text
            documentProcessor.processDocument(document, extractedText)
              .then(success => {
                if (success) {
                  console.log(`Document ${document.id} processed successfully`);
                } else {
                  console.error(`Failed to process document ${document.id}`);
                }
              })
              .catch(error => {
                console.error(`Error processing document ${document.id}:`, error);
              });
          } else {
            // For other file types, use the binary data
            // Extract text from the file
            const extractedText = await documentProcessor.extractTextFromDocument(
              fileData,
              document.file_type,
              document.file_name
            );
            
            // Process the document with the extracted text
            documentProcessor.processDocument(document, extractedText)
              .then(success => {
                if (success) {
                  console.log(`Document ${document.id} processed successfully`);
                } else {
                  console.error(`Failed to process document ${document.id}`);
                }
              })
              .catch(error => {
                console.error(`Error processing document ${document.id}:`, error);
              });
          }
        }
      } catch (error) {
        console.error('Error extracting text from file:', error);
      }
    }
    
    return res.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while uploading document'
    });
  }
});

// Get all documents for an agent
app.get('/', async (req, res) => {
  try {
    const { agent_id } = req.query;
    
    if (!agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch documents',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      documents: data
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching documents'
    });
  }
});

// Export the Express app as a serverless function
module.exports = app;
