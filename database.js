const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'predictions.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
  // Classes table
  db.run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Groups table
  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id),
    UNIQUE(class_id, name)
  )`);

  // Add class_id column to groups table if it doesn't exist (for existing databases)
  db.run(`PRAGMA table_info(groups)`, [], (err, info) => {
    db.all(`PRAGMA table_info(groups)`, [], (err, columns) => {
      const hasClassId = columns && columns.some(col => col.name === 'class_id');
      if (!hasClassId) {
        db.run(`ALTER TABLE groups ADD COLUMN class_id INTEGER DEFAULT 1`);
      }
    });
  });

  // Predictions table
  db.run(`CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    game_date DATE NOT NULL,
    predicted_winner TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    UNIQUE(group_id, game_id)
  )`);

  // Results table
  db.run(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT UNIQUE NOT NULL,
    game_date DATE NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    winner TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('Database initialized');
});

module.exports = db;
