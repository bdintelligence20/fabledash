// app.js - Main application file
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const csvParser = require('csv-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Update this near the top of app.js
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
});

// Use memory storage instead of disk storage to avoid path issues
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


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
