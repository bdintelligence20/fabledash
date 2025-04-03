// Supabase routes for client and task management
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../supabase');

// Import route modules
const clientRoutes = require('./supabase/client-routes');
const taskStatusRoutes = require('./supabase/task-status-routes');
const taskRoutes = require('./supabase/task-routes');
const taskCommentRoutes = require('./supabase/task-comment-routes');
const taskAttachmentRoutes = require('./supabase/task-attachment-routes');
const taskCalendarRoutes = require('./supabase/task-calendar-routes');
const agentRoutes = require('./supabase/agent-routes');
const documentRoutes = require('./supabase/document-routes');
const chatRoutes = require('./supabase/chat-routes');

// Simple health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('clients').select('count').limit(1);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: 'Supabase connection is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Supabase connection failed',
      error: error.message
    });
  }
});

// Use the route modules with proper prefixes
router.use('/clients', clientRoutes);
router.use('/task-statuses', taskStatusRoutes);
router.use('/tasks', taskRoutes);
router.use('/task-comments', taskCommentRoutes);
router.use('/task-attachments', taskAttachmentRoutes);
router.use('/task-calendar', taskCalendarRoutes);
router.use('/agents', agentRoutes);
router.use('/documents', documentRoutes);
router.use('/chats', chatRoutes);

// Export the router
module.exports = router;
