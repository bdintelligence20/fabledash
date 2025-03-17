// vercel-app-supabase-final.js - Modified for Vercel serverless environment with Supabase
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Supabase client
const supabase = require('./supabase');

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make supabase available to routes
app.use((req, res, next) => {
  req.app.locals.supabase = supabase;
  next();
});

// Import routes
const supabaseRoutes = require('./routes/supabase-routes');

// Use routes
app.use('/api/supabase', supabaseRoutes);

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running with Supabase',
    timestamp: new Date().toISOString()
  });
});

// Export the Express app for Vercel
module.exports = app;
