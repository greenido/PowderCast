const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Path to the database (same as setup-db.js)
const dbPath = path.join(__dirname, '..', 'powdercast.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('Database not found. Run yarn db:setup and yarn db:seed first.');
  process.exit(1);
}

// Open database
const db = new Database(dbPath, { readonly: true });

// Get all resorts
const resorts = db.prepare('SELECT * FROM resorts').all();

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write resorts to JSON file
const outputPath = path.join(publicDir, 'resorts.json');
fs.writeFileSync(outputPath, JSON.stringify(resorts, null, 2));

console.log(`✓ Generated ${outputPath} with ${resorts.length} resorts`);

db.close();
