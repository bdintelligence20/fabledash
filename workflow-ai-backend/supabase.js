// supabase.js - Supabase client configuration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Handle missing credentials more gracefully for serverless environments
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
  
  // Create a mock client that will throw errors when methods are called
  const mockClient = new Proxy({}, {
    get: function(target, prop) {
      if (typeof prop === 'string' && !['then', 'catch', 'finally'].includes(prop)) {
        return () => {
          throw new Error('Supabase client not properly initialized. Missing environment variables.');
        };
      }
      return undefined;
    }
  });
  
  module.exports = mockClient;
} else {
  // Create the real Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  module.exports = supabase;
}
