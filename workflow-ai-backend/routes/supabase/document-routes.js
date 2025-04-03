const express = require('express');
const router = express.Router();
const supabase = require('../../supabase');
const documentProcessor = require('./document-processor');
// Try to import uuid, but provide a fallback if it fails
let uuidv4;
try {
  const { v4 } = require('uuid');
  uuidv4 = v4;
} catch (error) {
  console.warn('UUID package not available, using fallback');
  // Simple fallback implementation of UUID v4
  uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// Upload a document
router.post('/', async (req, res) => {
  try {
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
router.get('/', async (req, res) => {
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

// Get document by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching document:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch document',
        error: error.message
      });
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    return res.json({
      success: true,
      document: data
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching document'
    });
  }
});

// Delete a document
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Document ID is required'
      });
    }
    
    // Get document details first
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !document) {
      console.error('Error fetching document:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Delete file from storage if file_path exists
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);
      
      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue anyway, we still want to delete the database record
      }
    }
    
    // Delete document record from database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Error deleting document record:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete document record',
        error: deleteError.message
      });
    }
    
    return res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting document'
    });
  }
});

module.exports = router;
