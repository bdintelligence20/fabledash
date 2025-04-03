// Task routes for Supabase
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');
const { formatTask } = require('./helper-functions');

// Create a new task
router.post('/', async (req, res) => {
  try {
    const { 
      client_id, 
      title, 
      description, 
      status_id, 
      start_date, 
      due_date,
      is_recurring,
      recurrence_pattern,
      priority
    } = req.body;
    
    if (!client_id || !title) {
      return res.status(400).json({ success: false, message: "Client ID and title are required" });
    }
    
    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();
    
    if (clientError) {
      if (clientError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
      throw clientError;
    }
    
    // Get default status if not provided
    let taskStatusId = status_id;
    if (!taskStatusId) {
      const { data: defaultStatus, error: defaultStatusError } = await supabase
        .from('task_statuses')
        .select('id')
        .eq('is_default', true)
        .single();
      
      if (!defaultStatusError && defaultStatus) {
        taskStatusId = defaultStatus.id;
      } else {
        // Fallback to first status if no default
        const { data: firstStatus, error: firstStatusError } = await supabase
          .from('task_statuses')
          .select('id')
          .order('position', { ascending: true })
          .limit(1)
          .single();
        
        if (firstStatusError) {
          return res.status(500).json({ success: false, message: "No task statuses found" });
        }
        
        taskStatusId = firstStatus.id;
      }
    }
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          client_id, 
          title, 
          description: description || null, 
          status_id: taskStatusId,
          start_date: start_date || null,
          due_date: due_date || null,
          is_recurring: is_recurring || false,
          recurrence_pattern: recurrence_pattern || null,
          priority: taskPriority
        }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      task: formatTask(data[0])
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ success: false, message: "Failed to create task" });
  }
});

// Get all tasks for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    
    if (clientError) {
      if (clientError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
      throw clientError;
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      tasks: data.map(task => formatTask(task))
    });
  } catch (error) {
    console.error("Error listing tasks:", error);
    res.status(500).json({ success: false, message: "Failed to list tasks" });
  }
});

// Get all tasks (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { status_id, priority, due_before, due_after, search } = req.query;
    
    let query = supabase
      .from('tasks')
      .select('*, clients(name)');
    
    if (status_id) {
      query = query.eq('status_id', status_id);
    }
    
    if (priority) {
      query = query.eq('priority', priority);
    }
    
    if (due_before) {
      query = query.lte('due_date', due_before);
    }
    
    if (due_after) {
      query = query.gte('due_date', due_after);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,clients.name.ilike.%${search}%`);
    }
    
    query = query.order('due_date', { ascending: true })
                .order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      tasks: data.map(task => ({
        ...formatTask(task),
        client_name: task.clients ? task.clients.name : null
      }))
    });
  } catch (error) {
    console.error("Error listing tasks:", error);
    res.status(500).json({ success: false, message: "Failed to list tasks" });
  }
});

// Get a specific task
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get task with client name
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*, clients(name)')
      .eq('id', id)
      .single();
    
    if (taskError) {
      if (taskError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Task not found" });
      }
      throw taskError;
    }
    
    // Get task attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false });
    
    if (attachmentsError) {
      throw attachmentsError;
    }
    
    // Get task comments
    const { data: comments, error: commentsError } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: true });
    
    if (commentsError) {
      throw commentsError;
    }
    
    res.json({
      success: true,
      task: {
        ...formatTask(task),
        client_name: task.clients ? task.clients.name : null,
        attachments: attachments || [],
        comments: comments || []
      }
    });
  } catch (error) {
    console.error("Error getting task:", error);
    res.status(500).json({ success: false, message: "Failed to get task" });
  }
});

// Update a task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      client_id, 
      title, 
      description, 
      status_id, 
      start_date, 
      due_date,
      is_recurring,
      recurrence_pattern,
      priority
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: "Task title is required" });
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
    
    // If client_id is changing, verify new client exists
    if (client_id && client_id !== existingTask.client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', client_id)
        .single();
      
      if (clientError && clientError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
    }
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    const taskPriority = priority && validPriorities.includes(priority) ? priority : existingTask.priority;
    
    const { data, error } = await supabase
      .from('tasks')
      .update({
        client_id: client_id || existingTask.client_id,
        title,
        description: description !== undefined ? description : existingTask.description,
        status_id: status_id || existingTask.status_id,
        start_date: start_date !== undefined ? start_date : existingTask.start_date,
        due_date: due_date !== undefined ? due_date : existingTask.due_date,
        is_recurring: is_recurring !== undefined ? is_recurring : existingTask.is_recurring,
        recurrence_pattern: recurrence_pattern !== undefined ? recurrence_pattern : existingTask.recurrence_pattern,
        priority: taskPriority,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, clients(name)');
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      task: {
        ...formatTask(data[0]),
        client_name: data[0].clients ? data[0].clients.name : null
      }
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ success: false, message: "Failed to update task" });
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ success: false, message: "Failed to delete task" });
  }
});

module.exports = router;
