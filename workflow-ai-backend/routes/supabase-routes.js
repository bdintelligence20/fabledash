// Supabase routes for client and task management
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../supabase');

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

// Export the router
module.exports = router;
