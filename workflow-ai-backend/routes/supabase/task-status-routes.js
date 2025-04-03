// Task status routes for Supabase
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');

// Get all task statuses
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('task_statuses')
      .select('*')
      .order('position', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      statuses: data
    });
  } catch (error) {
    console.error("Error listing task statuses:", error);
    res.status(500).json({ success: false, message: "Failed to list task statuses" });
  }
});

// Create a custom task status
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({ success: false, message: "Status name and color are required" });
    }
    
    // Get the highest position
    const { data: maxPositionData, error: maxPositionError } = await supabase
      .from('task_statuses')
      .select('position')
      .order('position', { ascending: false })
      .limit(1);
    
    if (maxPositionError) {
      throw maxPositionError;
    }
    
    const position = maxPositionData.length > 0 ? maxPositionData[0].position + 1 : 0;
    
    const { data, error } = await supabase
      .from('task_statuses')
      .insert([
        { name, color, position }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      status: data[0]
    });
  } catch (error) {
    console.error("Error creating task status:", error);
    res.status(500).json({ success: false, message: "Failed to create task status" });
  }
});

// Update a task status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({ success: false, message: "Status name and color are required" });
    }
    
    // Check if status exists
    const { data: existingStatus, error: checkError } = await supabase
      .from('task_statuses')
      .select('*')
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Task status not found" });
      }
      throw checkError;
    }
    
    const { data, error } = await supabase
      .from('task_statuses')
      .update({ name, color })
      .eq('id', id)
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      status: data[0]
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({ success: false, message: "Failed to update task status" });
  }
});

// Delete a task status
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if status exists
    const { data: existingStatus, error: checkError } = await supabase
      .from('task_statuses')
      .select('*')
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Task status not found" });
      }
      throw checkError;
    }
    
    // Check if this is the default status
    if (existingStatus.is_default) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete the default status" 
      });
    }
    
    // Check if this status is in use
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status_id', id);
    
    if (countError) {
      throw countError;
    }
    
    if (count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete status that is being used by tasks. Reassign tasks first." 
      });
    }
    
    const { error } = await supabase
      .from('task_statuses')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: "Task status deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting task status:", error);
    res.status(500).json({ success: false, message: "Failed to delete task status" });
  }
});

// Reorder task statuses
router.post('/reorder', async (req, res) => {
  try {
    const { statusIds } = req.body;
    
    if (!statusIds || !Array.isArray(statusIds)) {
      return res.status(400).json({ success: false, message: "Status IDs array is required" });
    }
    
    // Update positions one by one
    for (let i = 0; i < statusIds.length; i++) {
      const { error } = await supabase
        .from('task_statuses')
        .update({ position: i })
        .eq('id', statusIds[i]);
      
      if (error) {
        throw error;
      }
    }
    
    const { data, error } = await supabase
      .from('task_statuses')
      .select('*')
      .order('position', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      statuses: data
    });
  } catch (error) {
    console.error("Error reordering task statuses:", error);
    res.status(500).json({ success: false, message: "Failed to reorder task statuses" });
  }
});

module.exports = router;
