import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'powdercast.db');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export interface Resort {
  id: string;
  name: string;
  state: string;
  region: string;
  base_lat: number;
  base_lon: number;
  base_elevation: number;
  summit_lat: number;
  summit_lon: number;
  summit_elevation: number;
  webcam_url: string | null;
  created_at: string;
}

export function initDatabase() {
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
  
  console.log('✅ Database schema initialized');
}

export function searchResorts(query: string): Resort[] {
  const stmt = db.prepare(`
    SELECT * FROM resorts 
    WHERE name LIKE ? OR state LIKE ? OR region LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  
  const searchTerm = `%${query}%`;
  return stmt.all(searchTerm, searchTerm, searchTerm) as Resort[];
}

export function getResortById(id: string): Resort | undefined {
  const stmt = db.prepare('SELECT * FROM resorts WHERE id = ?');
  return stmt.get(id) as Resort | undefined;
}

export function getAllResorts(): Resort[] {
  const stmt = db.prepare('SELECT * FROM resorts ORDER BY name');
  return stmt.all() as Resort[];
}
