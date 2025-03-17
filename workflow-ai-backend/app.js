// app.js - Main application file
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
});

// Import routes
const supabaseRoutes = require('./routes/supabase-routes');

// Use routes
app.use('/api', supabaseRoutes);


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
