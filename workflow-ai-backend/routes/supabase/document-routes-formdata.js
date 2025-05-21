const express = require('express');
const router = express.Router();
const supabase = require('../../supabase');
const documentProcessor = require('./document-processor');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use /tmp directory for Vercel or uploads directory for local development
    const uploadsDir = process.env.NODE_ENV === 'production' 
      ? '/tmp' 
      : path.join(__dirname, '../../uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueFileName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFileName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// Upload a document using FormData
router.post('/formdata', upload.single('file'), async (req, res) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    console.log('FormData upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const agent_id = req.body.agent_id;
    
    if (!agent_id || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID and file are required'
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
    
    // Read file from disk
    const filePath = req.file.path;
    const fileData = fs.readFileSync(filePath);
    
    // Generate a unique file name
    const uniqueFileName = `${uuidv4()}-${req.file.originalname}`;
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`${agent_id}/${uniqueFileName}`, fileData, {
        contentType: req.file.mimetype || 'application/octet-stream',
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
      file_name: req.file.originalname,
      file_type: req.file.mimetype || 'application/octet-stream',
      file_path: uploadData.path,
      file_url: publicUrl,
      extracted_text: null,
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
    
    // Clean up temporary file
    fs.unlinkSync(filePath);
    
    // Process the document in the background
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
    
    return res.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while uploading document',
      error: error.message
    });
  }
});

// Handle preflight requests for CORS
router.options('/formdata', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

module.exports = router;
