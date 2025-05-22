// Task calendar routes for Supabase
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');
const { formatTask } = require('./helper-functions');

// Get tasks due today
router.get('/tasks/due/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*, clients(name)')
      .eq('due_date', today)
      .order('created_at', { ascending: false });
    
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
    console.error("Error getting tasks due today:", error);
    res.status(500).json({ success: false, message: "Failed to get tasks due today" });
  }
});

// Get tasks for calendar view (within date range)
router.get('/tasks/calendar', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: "Start date and end date are required" });
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*, clients(name), task_statuses(name, color)')
      .or(`start_date.gte.${start_date},start_date.lte.${end_date},due_date.gte.${start_date},due_date.lte.${end_date},(start_date.lte.${start_date},due_date.gte.${end_date})`)
      .order('start_date', { ascending: true })
      .order('due_date', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      tasks: data.map(task => ({
        ...formatTask(task),
        client_name: task.clients ? task.clients.name : null,
        status_name: task.task_statuses ? task.task_statuses.name : null,
        status_color: task.task_statuses ? task.task_statuses.color : null
      }))
    });
  } catch (error) {
    console.error("Error getting calendar tasks:", error);
    res.status(500).json({ success: false, message: "Failed to get calendar tasks" });
  }
});

// Get tasks for kanban view (grouped by status)
router.get('/tasks/kanban', async (req, res) => {
  try {
    const { client_id } = req.query;
    
    // Get all statuses
    const { data: statuses, error: statusesError } = await supabase
      .from('task_statuses')
      .select('*')
      .order('position', { ascending: true });
    
    if (statusesError) {
      throw statusesError;
    }
    
    // Build query based on whether client_id is provided
    let query = supabase
      .from('tasks')
      .select('*, clients(name)');
    
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    
    query = query.order('due_date', { ascending: true })
                .order('created_at', { ascending: false });
    
    const { data: tasks, error: tasksError } = await query;
    
    if (tasksError) {
      throw tasksError;
    }
    
    // Group tasks by status
    const kanbanData = statuses.map(status => {
      const statusTasks = tasks.filter(task => task.status_id === status.id);
      
      return {
        status: status,
        tasks: statusTasks.map(task => ({
          ...formatTask(task),
          client_name: task.clients ? task.clients.name : null
        }))
      };
    });
    
    res.json({
      success: true,
      kanban: kanbanData
    });
  } catch (error) {
    console.error("Error getting kanban data:", error);
    res.status(500).json({ success: false, message: "Failed to get kanban data" });
  }
});

module.exports = router;
