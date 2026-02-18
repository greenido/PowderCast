const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'powdercast.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

const createResortsTable = `
  CREATE TABLE IF NOT EXISTS resorts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    region TEXT NOT NULL,
    base_lat REAL NOT NULL,
    base_lon REAL NOT NULL,
    base_elevation INTEGER NOT NULL,
    summit_lat REAL NOT NULL,
    summit_lon REAL NOT NULL,
    summit_elevation INTEGER NOT NULL,
    webcam_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const createSearchIndex = `
  CREATE INDEX IF NOT EXISTS idx_resort_search 
  ON resorts(name, state, region)
`;

db.exec(createResortsTable);
db.exec(createSearchIndex);

console.log('✅ Database tables created successfully');

db.close();
