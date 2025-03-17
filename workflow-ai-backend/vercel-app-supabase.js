// vercel-app-supabase.js - Modified for Vercel serverless environment with Supabase
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

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Import routes
const supabaseRoutes = require('./routes/supabase-routes');

// Use routes
app.use('/api', supabaseRoutes);

// Create uploads directory in /tmp for serverless environments
const uploadsDir = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'uploads') 
  : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Make uploadsDir available to routes
app.locals.uploadsDir = uploadsDir;

// Health check endpoint with Supabase connection test
app.get('/api/health', async (req, res) => {
  try {
    // Basic health check
    const healthInfo = {
      status: 'ok',
      message: 'Server is running with Supabase',
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV || 'not set',
        supabase_url: process.env.SUPABASE_URL ? 'set' : 'not set',
        supabase_key: process.env.SUPABASE_KEY ? 'set' : 'not set',
        openai_key: process.env.OPENAI_API_KEY ? 'set' : 'not set'
      }
    };

    // Test Supabase connection if credentials are available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        // Simple query to test connection
        const { data, error } = await supabase.from('clients').select('count').limit(1);
        
        if (error) {
          healthInfo.supabase_connection = {
            status: 'error',
            message: error.message
          };
        } else {
          healthInfo.supabase_connection = {
            status: 'connected',
            message: 'Successfully connected to Supabase'
          };
        }
      } catch (supabaseError) {
        healthInfo.supabase_connection = {
          status: 'error',
          message: supabaseError.message
        };
      }
    } else {
      healthInfo.supabase_connection = {
        status: 'not_configured',
        message: 'Supabase credentials not provided'
      };
    }

    res.json(healthInfo);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export the Express app for Vercel
module.exports = app;
