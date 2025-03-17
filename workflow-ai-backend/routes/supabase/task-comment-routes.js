// Task comment routes for Supabase
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');

// Add a comment to a task
router.post('/tasks/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: "Comment content is required" });
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
    
    const { data, error } = await supabase
      .from('task_comments')
      .insert([
        { task_id: id, content }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      comment: data[0]
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
});

module.exports = router;
