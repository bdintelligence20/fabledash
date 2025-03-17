// Agent routes for Supabase
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');

// Create a new agent
router.post('/agents/create', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Agent name is required" });
    }
    
    const { data, error } = await supabase
      .from('agents')
      .insert([
        { name, description: description || '' }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      agent: {
        id: data[0].id,
        name: data[0].name,
        description: data[0].description,
        created_at: data[0].created_at
      }
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ success: false, message: "Failed to create agent" });
  }
});

// List all agents
router.get('/agents/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      agents: data.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        created_at: agent.created_at
      }))
    });
  } catch (error) {
    console.error("Error listing agents:", error);
    res.status(500).json({ success: false, message: "Failed to list agents" });
  }
});

module.exports = router;
