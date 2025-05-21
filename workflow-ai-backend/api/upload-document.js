// api/upload-document.js - Serverless function for handling large document uploads
const supabase = require('../supabase');
const documentProcessor = require('../routes/supabase/document-processor');
const { v4: uuidv4 } = require('uuid');

// Maximum request size (1GB)
const MAX_SIZE = 1024 * 1024 * 1024;

// Helper function to parse JSON with size limit
const parseJSON = async (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_SIZE) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        resolve(data);
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    
    req.on('error', reject);
  });
};

// Main handler function
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://fabledash.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
    return;
  }
  
  try {
    console.log('Document upload request received');
    
    // Parse request body
    const body = await parseJSON(req);
    const { agent_id, file_data, file_name, content_type, extracted_text } = body;
    
    if (!agent_id || !file_data || !file_name) {
      res.status(400).json({
        success: false,
        message: 'Agent ID, file data, and file name are required'
      });
      return;
    }
    
    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();
    
    if (agentError || !agent) {
      console.error('Error fetching agent:', agentError);
      res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
      return;
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
      res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage',
        error: uploadError.message
      });
      return;
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
      res.status(500).json({
        success: false,
        message: 'Failed to create document record',
        error: documentError.message
      });
      return;
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
    
    res.status(200).json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading document',
      error: error.message
    });
  }
};
