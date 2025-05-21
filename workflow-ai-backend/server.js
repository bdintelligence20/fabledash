// server.js - Custom server for handling large file uploads
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = require('./vercel-app-supabase');

// Create a new Express app for the custom server
const server = express();

// CORS configuration
server.use(cors({
  origin: ['https://fabledash.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add CORS headers to all responses as a fallback
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://fabledash.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Configure body parser with increased limits
server.use(bodyParser.json({ limit: '1gb' }));
server.use(bodyParser.urlencoded({ extended: true, limit: '1gb' }));

// Use the Vercel app as middleware
server.use(app);

// Start the server if not running in Vercel
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3001;
  server.listen(port, () => {
    console.log(`Custom server running on port ${port} with increased limits`);
  });
}

module.exports = server;
