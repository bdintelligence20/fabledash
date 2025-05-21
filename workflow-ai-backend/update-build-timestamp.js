// update-build-timestamp.js
// This script updates the BUILD_TIMESTAMP in vercel.json to force a rebuild on Vercel

const fs = require('fs');
const path = require('path');

// Path to vercel.json
const vercelJsonPath = path.join(__dirname, 'vercel.json');

try {
  // Read the current vercel.json
  const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  
  // Update the BUILD_TIMESTAMP with the current date and time
  vercelJson.env = vercelJson.env || {};
  vercelJson.env.BUILD_TIMESTAMP = new Date().toISOString();
  
  // Write the updated vercel.json back to disk
  fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelJson, null, 2));
  
  console.log(`Updated BUILD_TIMESTAMP to ${vercelJson.env.BUILD_TIMESTAMP}`);
  console.log('This will force Vercel to rebuild the project on the next deployment.');
} catch (error) {
  console.error('Error updating BUILD_TIMESTAMP:', error);
  process.exit(1);
}
