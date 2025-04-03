// Client routes for Supabase
const express = require('express');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');
const { formatClient } = require('./helper-functions');

// Create a new client
router.post('/', async (req, res) => {
  try {
    const { name, contact_email, contact_phone, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Client name is required" });
    }
    
    const { data, error } = await supabase
      .from('clients')
      .insert([
        { 
          name, 
          contact_email: contact_email || null, 
          contact_phone: contact_phone || null, 
          notes: notes || null 
        }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      client: formatClient(data[0])
    });
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ success: false, message: "Failed to create client" });
  }
});

// Get all clients
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      clients: data.map(client => formatClient(client))
    });
  } catch (error) {
    console.error("Error listing clients:", error);
    res.status(500).json({ success: false, message: "Failed to list clients" });
  }
});

// Get a specific client
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
      throw error;
    }
    
    res.json({
      success: true,
      client: formatClient(data)
    });
  } catch (error) {
    console.error("Error getting client:", error);
    res.status(500).json({ success: false, message: "Failed to get client" });
  }
});

// Update a client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_email, contact_phone, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Client name is required" });
    }
    
    // Check if client exists
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
      throw checkError;
    }
    
    const { data, error } = await supabase
      .from('clients')
      .update({ 
        name, 
        contact_email: contact_email || null, 
        contact_phone: contact_phone || null, 
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      client: formatClient(data[0])
    });
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ success: false, message: "Failed to update client" });
  }
});

// Delete a client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if client exists
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: "Client not found" });
      }
      throw checkError;
    }
    
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: "Client deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ success: false, message: "Failed to delete client" });
  }
});

module.exports = router;
