const express = require('express');
const router = express.Router();
const supabase = require('../../supabase');

// Create a new agent
router.post('/', async (req, res) => {
  try {
    const { name, description, client_id, parent_id, is_parent = true } = req.body;
    
    console.log('Creating new agent:', { name, description, client_id, parent_id, is_parent });
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Agent name is required'
      });
    }
    
    // Prepare agent data
    const agentData = {
      name,
      description,
      is_parent
    };
    
    // Add client_id if provided and valid
    if (client_id) {
      if (isNaN(parseInt(client_id))) {
        console.error('Invalid client ID:', client_id);
        return res.status(400).json({
          success: false,
          message: `Invalid client ID: ${client_id}. Must be an integer.`
        });
      }
      agentData.client_id = parseInt(client_id);
    }
    
    // Add parent_id if provided and valid
    if (parent_id) {
      if (isNaN(parseInt(parent_id))) {
        console.error('Invalid parent ID:', parent_id);
        return res.status(400).json({
          success: false,
          message: `Invalid parent ID: ${parent_id}. Must be an integer.`
        });
      }
      agentData.parent_id = parseInt(parent_id);
    }
    
    // Create agent in database
    const { data, error } = await supabase
      .from('agents')
      .insert(agentData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating agent:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create agent',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      agent: data
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating agent'
    });
  }
});

// Get all agents
router.get('/', async (req, res) => {
  try {
    const { is_parent, client_id } = req.query;
    
    console.log('Fetching agents with filters:', { is_parent, client_id });
    
    let query = supabase.from('agents').select('*');
    
    // Filter by is_parent if provided
    if (is_parent !== undefined) {
      const isParentBool = is_parent === 'true';
      query = query.eq('is_parent', isParentBool);
    }
    
    // Filter by client_id if provided
    if (client_id) {
      // Check if client_id is a valid integer
      if (isNaN(parseInt(client_id))) {
        console.error('Invalid client ID:', client_id);
        return res.status(400).json({
          success: false,
          message: `Invalid client ID: ${client_id}. Must be an integer.`
        });
      }
      query = query.eq('client_id', parseInt(client_id));
    }
    
    // Order by created_at
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching agents:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch agents',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      agents: data
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching agents'
    });
  }
});

// Get child agents for a parent agent
router.get('/parent/:parentId/children', async (req, res) => {
  try {
    const { parentId } = req.params;
    
    console.log('Fetching child agents for parent ID:', parentId);
    
    // Check if parentId is a valid integer
    if (isNaN(parseInt(parentId))) {
      console.error('Invalid parent ID:', parentId);
      return res.status(400).json({
        success: false,
        message: `Invalid parent ID: ${parentId}. Must be an integer.`
      });
    }
    
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('parent_id', parseInt(parentId))
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching child agents:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch child agents',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      agents: data
    });
  } catch (error) {
    console.error('Error fetching child agents:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching child agents'
    });
  }
});

// Get agent by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Fetching agent with ID:', id);
    
    // Check if id is a valid integer
    if (isNaN(parseInt(id))) {
      console.error('Invalid agent ID:', id);
      return res.status(400).json({
        success: false,
        message: `Invalid agent ID: ${id}. Must be an integer.`
      });
    }
    
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', parseInt(id))
      .single();
    
    if (error) {
      console.error('Error fetching agent:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch agent',
        error: error.message
      });
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    return res.json({
      success: true,
      agent: data
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching agent'
    });
  }
});

// Update an agent
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, client_id } = req.body;
    
    console.log('Updating agent with ID:', id);
    
    // Check if id is a valid integer
    if (isNaN(parseInt(id))) {
      console.error('Invalid agent ID:', id);
      return res.status(400).json({
        success: false,
        message: `Invalid agent ID: ${id}. Must be an integer.`
      });
    }
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Agent name is required'
      });
    }
    
    // Update agent in database
    const { data, error } = await supabase
      .from('agents')
      .update({
        name,
        description,
        client_id,
        updated_at: new Date()
      })
      .eq('id', parseInt(id))
      .select()
      .single();
    
    if (error) {
      console.error('Error updating agent:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update agent',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      agent: data
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating agent'
    });
  }
});

// Delete an agent
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Deleting agent with ID:', id);
    
    // Check if id is a valid integer
    if (isNaN(parseInt(id))) {
      console.error('Invalid agent ID:', id);
      return res.status(400).json({
        success: false,
        message: `Invalid agent ID: ${id}. Must be an integer.`
      });
    }
    
    // First check if this agent has child agents
    const { data: childAgents, error: childError } = await supabase
      .from('agents')
      .select('id')
      .eq('parent_id', parseInt(id));
    
    if (childError) {
      console.error('Error checking for child agents:', childError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check for child agents',
        error: childError.message
      });
    }
    
    if (childAgents && childAgents.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete agent with child agents. Delete child agents first.'
      });
    }
    
    // Delete agent from database
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', parseInt(id));
    
    if (error) {
      console.error('Error deleting agent:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete agent',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting agent'
    });
  }
});

module.exports = router;
