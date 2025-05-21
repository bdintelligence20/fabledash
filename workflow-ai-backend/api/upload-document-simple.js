// api/upload-document-simple.js - Simplified serverless function for handling document uploads
const supabase = require('../supabase');
const { v4: uuidv4 } = require('uuid');

// Handle CORS preflight requests
const handleCors = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
};

// Main handler function
module.exports = async (req, res) => {
  // Handle CORS
  if (handleCors(req, res)) return;
  
  // Log request information
  console.log('Upload document simple request received');
  console.log('Request method:', req.method);
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }
  
  try {
    // Parse request body
    const { agent_id, file_data, file_name, content_type } = req.body;
    
    if (!agent_id || !file_data || !file_name) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID, file data, and file name are required'
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
    
    // Return success response
    return res.status(200).json({
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
};
