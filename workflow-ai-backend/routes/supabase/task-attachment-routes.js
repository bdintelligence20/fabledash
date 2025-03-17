// Task attachment routes for Supabase
const express = require('express');
const multer = require('multer');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');

// Configure multer for file uploads (memory storage for Vercel)
const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload an attachment to a task (using Supabase storage)
router.post('/tasks/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    
    // Check if task exists
    const { data: existingTask, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (taskError) {
      if (taskError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Task not found" });
      }
      throw taskError;
    }
    
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = uniqueSuffix + '-' + file.originalname;
    const filePath = `tasks/${id}/${fileName}`;
    
    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('attachments')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype
      });
    
    if (storageError) {
      throw storageError;
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('attachments')
      .getPublicUrl(filePath);
    
    const publicUrl = publicUrlData.publicUrl;
    
    // Save attachment record in database
    const { data, error } = await supabase
      .from('task_attachments')
      .insert([
        {
          task_id: id,
          file_name: file.originalname,
          file_path: publicUrl,
          file_type: file.mimetype,
          file_size: file.size
        }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      attachment: data[0]
    });
  } catch (error) {
    console.error("Error uploading attachment:", error);
    res.status(500).json({ success: false, message: "Failed to upload attachment" });
  }
});

// Delete an attachment
router.delete('/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get attachment details
    const { data: attachment, error: attachmentError } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (attachmentError) {
      if (attachmentError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Attachment not found" });
      }
      throw attachmentError;
    }
    
    // Extract path from URL
    const urlParts = attachment.file_path.split('/');
    const storagePath = `tasks/${attachment.task_id}/${urlParts[urlParts.length - 1]}`;
    
    // Delete from Supabase Storage
    const { error: storageError } = await supabase
      .storage
      .from('attachments')
      .remove([storagePath]);
    
    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue anyway to delete the database record
    }
    
    // Delete database record
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: "Attachment deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ success: false, message: "Failed to delete attachment" });
  }
});

module.exports = router;
