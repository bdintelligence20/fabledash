// Client and Task Management Routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const taskId = req.body.task_id;
    const uploadDir = path.join(__dirname, '../uploads/tasks', taskId.toString());
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Memory storage for Vercel environment
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to format client data
function formatClient(client) {
  return {
    id: client.id,
    name: client.name,
    contact_email: client.contact_email,
    contact_phone: client.contact_phone,
    notes: client.notes,
    created_at: client.created_at,
    updated_at: client.updated_at
  };
}

// Helper function to format task data
function formatTask(task) {
  return {
    id: task.id,
    client_id: task.client_id,
    title: task.title,
    description: task.description,
    status_id: task.status_id,
    start_date: task.start_date,
    due_date: task.due_date,
    is_recurring: Boolean(task.is_recurring),
    recurrence_pattern: task.recurrence_pattern ? JSON.parse(task.recurrence_pattern) : null,
    priority: task.priority,
    created_at: task.created_at,
    updated_at: task.updated_at
  };
}

// CLIENT ROUTES

// Create a new client
router.post('/clients/create', async (req, res) => {
  try {
    const { name, contact_email, contact_phone, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Client name is required" });
    }
    
    const result = await req.app.locals.db.run(
      'INSERT INTO clients (name, contact_email, contact_phone, notes) VALUES (?, ?, ?, ?)',
      [name, contact_email || null, contact_phone || null, notes || null]
    );
    
    const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      client: formatClient(client)
    });
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ success: false, message: "Failed to create client" });
  }
});

// Get all clients
router.get('/clients/list', async (req, res) => {
  try {
    const clients = await req.app.locals.db.all('SELECT * FROM clients ORDER BY name ASC');
    
    res.json({
      success: true,
      clients: clients.map(client => formatClient(client))
    });
  } catch (error) {
    console.error("Error listing clients:", error);
    res.status(500).json({ success: false, message: "Failed to list clients" });
  }
});

// Get a specific client
router.get('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    res.json({
      success: true,
      client: formatClient(client)
    });
  } catch (error) {
    console.error("Error getting client:", error);
    res.status(500).json({ success: false, message: "Failed to get client" });
  }
});

// Update a client
router.put('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_email, contact_phone, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Client name is required" });
    }
    
    const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    await req.app.locals.db.run(
      'UPDATE clients SET name = ?, contact_email = ?, contact_phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, contact_email || null, contact_phone || null, notes || null, id]
    );
    
    const updatedClient = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', id);
    
    res.json({
      success: true,
      client: formatClient(updatedClient)
    });
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ success: false, message: "Failed to update client" });
  }
});

// Delete a client
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    await req.app.locals.db.run('DELETE FROM clients WHERE id = ?', id);
    
    res.json({
      success: true,
      message: "Client deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ success: false, message: "Failed to delete client" });
  }
});

// TASK STATUS ROUTES

// Get all task statuses
router.get('/task-statuses/list', async (req, res) => {
  try {
    const statuses = await req.app.locals.db.all('SELECT * FROM task_statuses ORDER BY position ASC');
    
    res.json({
      success: true,
      statuses: statuses
    });
  } catch (error) {
    console.error("Error listing task statuses:", error);
    res.status(500).json({ success: false, message: "Failed to list task statuses" });
  }
});

// Create a custom task status
router.post('/task-statuses/create', async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({ success: false, message: "Status name and color are required" });
    }
    
    // Get the highest position
    const maxPosition = await req.app.locals.db.get('SELECT MAX(position) as maxPos FROM task_statuses');
    const position = (maxPosition.maxPos || 0) + 1;
    
    const result = await req.app.locals.db.run(
      'INSERT INTO task_statuses (name, color, position) VALUES (?, ?, ?)',
      [name, color, position]
    );
    
    const status = await req.app.locals.db.get('SELECT * FROM task_statuses WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error("Error creating task status:", error);
    res.status(500).json({ success: false, message: "Failed to create task status" });
  }
});

// Update a task status
router.put('/task-statuses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({ success: false, message: "Status name and color are required" });
    }
    
    const status = await req.app.locals.db.get('SELECT * FROM task_statuses WHERE id = ?', id);
    
    if (!status) {
      return res.status(404).json({ success: false, message: "Task status not found" });
    }
    
    await req.app.locals.db.run(
      'UPDATE task_statuses SET name = ?, color = ? WHERE id = ?',
      [name, color, id]
    );
    
    const updatedStatus = await req.app.locals.db.get('SELECT * FROM task_statuses WHERE id = ?', id);
    
    res.json({
      success: true,
      status: updatedStatus
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({ success: false, message: "Failed to update task status" });
  }
});

// Delete a task status
router.delete('/task-statuses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const status = await req.app.locals.db.get('SELECT * FROM task_statuses WHERE id = ?', id);
    
    if (!status) {
      return res.status(404).json({ success: false, message: "Task status not found" });
    }
    
    // Check if this status is in use
    const tasksWithStatus = await req.app.locals.db.get('SELECT COUNT(*) as count FROM tasks WHERE status_id = ?', id);
    
    if (tasksWithStatus.count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete status that is being used by tasks. Reassign tasks first." 
      });
    }
    
    // Check if this is the default status
    if (status.is_default) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete the default status" 
      });
    }
    
    await req.app.locals.db.run('DELETE FROM task_statuses WHERE id = ?', id);
    
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
router.post('/task-statuses/reorder', async (req, res) => {
  try {
    const { statusIds } = req.body;
    
    if (!statusIds || !Array.isArray(statusIds)) {
      return res.status(400).json({ success: false, message: "Status IDs array is required" });
    }
    
    // Update positions in a transaction
    await req.app.locals.db.run('BEGIN TRANSACTION');
    
    for (let i = 0; i < statusIds.length; i++) {
      await req.app.locals.db.run(
        'UPDATE task_statuses SET position = ? WHERE id = ?',
        [i, statusIds[i]]
      );
    }
    
    await req.app.locals.db.run('COMMIT');
    
    const updatedStatuses = await req.app.locals.db.all('SELECT * FROM task_statuses ORDER BY position ASC');
    
    res.json({
      success: true,
      statuses: updatedStatuses
    });
  } catch (error) {
    await req.app.locals.db.run('ROLLBACK');
    console.error("Error reordering task statuses:", error);
    res.status(500).json({ success: false, message: "Failed to reorder task statuses" });
  }
});

// TASK ROUTES

// Create a new task
router.post('/tasks/create', async (req, res) => {
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
    const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', client_id);
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    // Get default status if not provided
    let taskStatusId = status_id;
    if (!taskStatusId) {
      const defaultStatus = await req.app.locals.db.get('SELECT id FROM task_statuses WHERE is_default = 1');
      if (defaultStatus) {
        taskStatusId = defaultStatus.id;
      } else {
        // Fallback to first status if no default
        const firstStatus = await req.app.locals.db.get('SELECT id FROM task_statuses ORDER BY position ASC LIMIT 1');
        if (firstStatus) {
          taskStatusId = firstStatus.id;
        } else {
          return res.status(500).json({ success: false, message: "No task statuses found" });
        }
      }
    }
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
    
    // Prepare recurrence pattern if task is recurring
    let recurrenceData = null;
    if (is_recurring && recurrence_pattern) {
      recurrenceData = JSON.stringify(recurrence_pattern);
    }
    
    const result = await req.app.locals.db.run(
      `INSERT INTO tasks (
        client_id, title, description, status_id, 
        start_date, due_date, is_recurring, recurrence_pattern, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id, 
        title, 
        description || null, 
        taskStatusId,
        start_date || null,
        due_date || null,
        is_recurring ? 1 : 0,
        recurrenceData,
        taskPriority
      ]
    );
    
    const task = await req.app.locals.db.get('SELECT * FROM tasks WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      task: formatTask(task)
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ success: false, message: "Failed to create task" });
  }
});

// Get all tasks for a client
router.get('/tasks/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client exists
    const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    const tasks = await req.app.locals.db.all(
      'SELECT * FROM tasks WHERE client_id = ? ORDER BY due_date ASC, created_at DESC',
      clientId
    );
    
    res.json({
      success: true,
      tasks: tasks.map(task => formatTask(task))
    });
  } catch (error) {
    console.error("Error listing tasks:", error);
    res.status(500).json({ success: false, message: "Failed to list tasks" });
  }
});

// Get all tasks (with optional filters)
router.get('/tasks/list', async (req, res) => {
  try {
    const { status_id, priority, due_before, due_after, search } = req.query;
    
    let query = 'SELECT t.*, c.name as client_name FROM tasks t JOIN clients c ON t.client_id = c.id WHERE 1=1';
    const params = [];
    
    if (status_id) {
      query += ' AND t.status_id = ?';
      params.push(status_id);
    }
    
    if (priority) {
      query += ' AND t.priority = ?';
      params.push(priority);
    }
    
    if (due_before) {
      query += ' AND t.due_date <= ?';
      params.push(due_before);
    }
    
    if (due_after) {
      query += ' AND t.due_date >= ?';
      params.push(due_after);
    }
    
    if (search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ? OR c.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY t.due_date ASC, t.created_at DESC';
    
    const tasks = await req.app.locals.db.all(query, params);
    
    res.json({
      success: true,
      tasks: tasks.map(task => ({
        ...formatTask(task),
        client_name: task.client_name
      }))
    });
  } catch (error) {
    console.error("Error listing tasks:", error);
    res.status(500).json({ success: false, message: "Failed to list tasks" });
  }
});

// Get a specific task
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await req.app.locals.db.get(
      'SELECT t.*, c.name as client_name FROM tasks t JOIN clients c ON t.client_id = c.id WHERE t.id = ?', 
      id
    );
    
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    
    // Get task attachments
    const attachments = await req.app.locals.db.all(
      'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC',
      id
    );
    
    // Get task comments
    const comments = await req.app.locals.db.all(
      'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC',
      id
    );
    
    res.json({
      success: true,
      task: {
        ...formatTask(task),
        client_name: task.client_name,
        attachments: attachments,
        comments: comments
      }
    });
  } catch (error) {
    console.error("Error getting task:", error);
    res.status(500).json({ success: false, message: "Failed to get task" });
  }
});

// Update a task
router.put('/tasks/:id', async (req, res) => {
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
    
    const task = await req.app.locals.db.get('SELECT * FROM tasks WHERE id = ?', id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    
    // If client_id is changing, verify new client exists
    if (client_id && client_id !== task.client_id) {
      const client = await req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', client_id);
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
    }
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    const taskPriority = priority && validPriorities.includes(priority) ? priority : task.priority;
    
    // Prepare recurrence pattern if task is recurring
    let recurrenceData = task.recurrence_pattern;
    if (is_recurring !== undefined) {
      if (is_recurring && recurrence_pattern) {
        recurrenceData = JSON.stringify(recurrence_pattern);
      } else if (!is_recurring) {
        recurrenceData = null;
      }
    }
    
    await req.app.locals.db.run(
      `UPDATE tasks SET 
        client_id = ?, 
        title = ?, 
        description = ?, 
        status_id = ?, 
        start_date = ?, 
        due_date = ?,
        is_recurring = ?,
        recurrence_pattern = ?,
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        client_id || task.client_id,
        title,
        description !== undefined ? description : task.description,
        status_id || task.status_id,
        start_date !== undefined ? start_date : task.start_date,
        due_date !== undefined ? due_date : task.due_date,
        is_recurring !== undefined ? (is_recurring ? 1 : 0) : task.is_recurring,
        recurrenceData,
        taskPriority,
        id
      ]
    );
    
    const updatedTask = await req.app.locals.db.get(
      'SELECT t.*, c.name as client_name FROM tasks t JOIN clients c ON t.client_id = c.id WHERE t.id = ?', 
      id
    );
    
    res.json({
      success: true,
      task: {
        ...formatTask(updatedTask),
        client_name: updatedTask.client_name
      }
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ success: false, message: "Failed to update task" });
  }
});

// Delete a task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await req.app.locals.db.get('SELECT * FROM tasks WHERE id = ?', id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    
    await req.app.locals.db.run('DELETE FROM tasks WHERE id = ?', id);
    
    res.json({
      success: true,
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ success: false, message: "Failed to delete task" });
  }
});

// Add a comment to a task
router.post('/tasks/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: "Comment content is required" });
    }
    
    const task = await req.app.locals.db.get('SELECT * FROM tasks WHERE id = ?', id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    
    const result = await req.app.locals.db.run(
      'INSERT INTO task_comments (task_id, content) VALUES (?, ?)',
      [id, content]
    );
    
    const comment = await req.app.locals.db.get('SELECT * FROM task_comments WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      comment: comment
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
});

// Upload an attachment to a task
router.post('/tasks/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    
    const task = await req.app.locals.db.get('SELECT * FROM tasks WHERE id = ?', id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    
    const result = await req.app.locals.db.run(
      'INSERT INTO task_attachments (task_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
      [id, file.originalname, file.path, file.mimetype, file.size]
    );
    
    const attachment = await req.app.locals.db.get('SELECT * FROM task_attachments WHERE id = ?', result.lastID);
    
    res.json({
      success: true,
      attachment: attachment
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
    
    const attachment = await req.app.locals.db.get('SELECT * FROM task_attachments WHERE id = ?', id);
    
    if (!attachment) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }
    
    // Delete the file
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }
    
    await req.app.locals.db.run('DELETE FROM task_attachments WHERE id = ?', id);
    
    res.json({
      success: true,
      message: "Attachment deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ success: false, message: "Failed to delete attachment" });
  }
});

// Get tasks due today
router.get('/tasks/due/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const tasks = await req.app.locals.db.all(
      `SELECT t.*, c.name as client_name 
       FROM tasks t 
       JOIN clients c ON t.client_id = c.id 
       WHERE date(t.due_date) = date(?)
       ORDER BY t.created_at DESC`,
      today
    );
    
    res.json({
      success: true,
      tasks: tasks.map(task => ({
        ...formatTask(task),
        client_name: task.client_name
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
    
    const tasks = await req.app.locals.db.all(
      `SELECT t.*, c.name as client_name, s.name as status_name, s.color as status_color
       FROM tasks t 
       JOIN clients c ON t.client_id = c.id
       JOIN task_statuses s ON t.status_id = s.id
       WHERE 
         (date(t.start_date) BETWEEN date(?) AND date(?)) OR
         (date(t.due_date) BETWEEN date(?) AND date(?)) OR
         (date(t.start_date) <= date(?) AND date(t.due_date) >= date(?))
       ORDER BY t.start_date ASC, t.due_date ASC`,
      [start_date, end_date, start_date, end_date, start_date, end_date]
    );
    
    res.json({
      success: true,
      tasks: tasks.map(task => ({
        ...formatTask(task),
        client_name: task.client_name,
        status_name: task.status_name,
        status_color: task.status_color
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
    const statuses = await req.app.locals.db.all('SELECT * FROM task_statuses ORDER BY position ASC');
    
    // Build query based on whether client_id is provided
    let query = `
      SELECT t.*, c.name as client_name
      FROM tasks t 
      JOIN clients c ON t.client_id = c.id
    `;
    
    const params = [];
    
    if (client_id) {
      query += ' WHERE t.client_id = ?';
      params.push(client_id);
    }
    
    query += ' ORDER BY t.due_date ASC, t.created_at DESC';
    
    const tasks = await req.app.locals.db.all(query, params);
    
    // Group tasks by status
    const kanbanData = statuses.map(status => {
      const statusTasks = tasks.filter(task => task.status_id === status.id);
      
      return {
        status: status,
        tasks: statusTasks.map(task => ({
          ...formatTask(task),
          client_name: task.client_name
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
