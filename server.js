require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
// Disable caching for static files during development
app.use(express.static('public', {
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// NBA API base URL (using balldontlie.io API)
const NBA_API_BASE = 'https://api.balldontlie.io/v1';
const NBA_API_KEY = process.env.NBA_API_KEY;

// Check if API key is configured
if (!NBA_API_KEY) {
  console.warn('⚠️  WARNING: NBA_API_KEY is not set in .env file. Game loading will fail.');
  console.warn('   Get a free API key from: https://www.balldontlie.io/');
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Fetch NBA games for a specific date
app.get('/api/games/:date', async (req, res) => {
  const { date } = req.params;

  if (!NBA_API_KEY) {
    return res.status(500).json({
      error: 'NBA API key not configured. Please add NBA_API_KEY to your .env file.'
    });
  }

  try {
    const response = await fetch(`${NBA_API_BASE}/games?dates[]=${date}`, {
      headers: {
        'Authorization': NBA_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    const games = data.data.map(game => ({
      id: game.id,
      date: date,
      homeTeam: game.home_team.full_name,
      awayTeam: game.visitor_team.full_name,
      homeScore: game.home_team_score,
      awayScore: game.visitor_team_score,
      status: game.status,
      winner: game.home_team_score > game.visitor_team_score ? game.home_team.full_name :
              game.visitor_team_score > game.home_team_score ? game.visitor_team.full_name : null
    }));

    res.json({ games });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get all classes
app.get('/api/classes', (req, res) => {
  db.all('SELECT * FROM classes ORDER BY name', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ classes: rows });
  });
});

// Add a new class
app.post('/api/classes', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  db.run('INSERT INTO classes (name) VALUES (?)', [name], function(err) {
    if (err) {
      return res.status(400).json({ error: 'Class name already exists' });
    }
    res.json({ id: this.lastID, name });
  });
});

// Update/rename a class
app.put('/api/classes/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  db.run('UPDATE classes SET name = ? WHERE id = ?', [name, id], function(err) {
    if (err) {
      return res.status(400).json({ error: 'Class name already exists' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ success: true });
  });
});

// Delete a class
app.delete('/api/classes/:id', (req, res) => {
  const { id } = req.params;

  // Check if class has groups
  db.get('SELECT COUNT(*) as count FROM groups WHERE class_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (row.count > 0) {
      return res.status(400).json({
        error: `Cannot delete class with ${row.count} group(s). Delete groups first.`
      });
    }

    db.run('DELETE FROM classes WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Class not found' });
      }
      res.json({ success: true });
    });
  });
});

// Get all groups (with class information)
app.get('/api/groups', (req, res) => {
  const query = `
    SELECT g.*, c.name as class_name
    FROM groups g
    JOIN classes c ON g.class_id = c.id
    ORDER BY c.name, g.name
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ groups: rows });
  });
});

// Add a new group
app.post('/api/groups', (req, res) => {
  const { name, classId } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  if (!classId) {
    return res.status(400).json({ error: 'Class ID is required' });
  }

  db.run('INSERT INTO groups (name, class_id) VALUES (?, ?)', [name, classId], function(err) {
    if (err) {
      return res.status(400).json({ error: 'Group name already exists in this class' });
    }
    res.json({ id: this.lastID, name, classId });
  });
});

// Update/rename a group
app.put('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  db.run('UPDATE groups SET name = ? WHERE id = ?', [name, id], function(err) {
    if (err) {
      return res.status(400).json({ error: 'Group name already exists in this class' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ success: true });
  });
});

// Delete a group
app.delete('/api/groups/:id', (req, res) => {
  const { id } = req.params;

  // Check if group has predictions
  db.get('SELECT COUNT(*) as count FROM predictions WHERE group_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (row.count > 0) {
      return res.status(400).json({
        error: `This group has ${row.count} prediction(s). Deleting will remove all predictions. Continue?`,
        hasPredictions: true,
        count: row.count
      });
    }

    db.run('DELETE FROM groups WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }
      res.json({ success: true });
    });
  });
});

// Force delete a group (with predictions)
app.delete('/api/groups/:id/force', (req, res) => {
  const { id } = req.params;

  // Delete predictions first
  db.run('DELETE FROM predictions WHERE group_id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Then delete the group
    db.run('DELETE FROM groups WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }
      res.json({ success: true });
    });
  });
});

// Save predictions for a date
app.post('/api/predictions', (req, res) => {
  const { predictions } = req.body;

  if (!predictions || !Array.isArray(predictions)) {
    return res.status(400).json({ error: 'Invalid predictions data' });
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO predictions
    (group_id, game_id, game_date, predicted_winner, home_team, away_team)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  predictions.forEach(p => {
    stmt.run([p.groupId, p.gameId, p.gameDate, p.predictedWinner, p.homeTeam, p.awayTeam]);
  });

  stmt.finalize((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// Get predictions for a specific date
app.get('/api/predictions/:date', (req, res) => {
  const { date } = req.params;

  db.all(`
    SELECT p.*, g.name as group_name, g.class_id, c.name as class_name
    FROM predictions p
    JOIN groups g ON p.group_id = g.id
    JOIN classes c ON g.class_id = c.id
    WHERE p.game_date = ?
  `, [date], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ predictions: rows });
  });
});

// Save game results
app.post('/api/results', (req, res) => {
  const { results } = req.body;

  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Invalid results data' });
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO results
    (game_id, game_date, home_team, away_team, winner, home_score, away_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  results.forEach(r => {
    stmt.run([r.gameId, r.gameDate, r.homeTeam, r.awayTeam, r.winner, r.homeScore, r.awayScore]);
  });

  stmt.finalize((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// Get accuracy statistics for all groups
app.get('/api/stats', (req, res) => {
  const query = `
    SELECT
      g.id,
      g.name,
      c.name as class_name,
      g.class_id,
      COUNT(p.id) as total_predictions,
      SUM(CASE WHEN p.predicted_winner = r.winner THEN 1 ELSE 0 END) as correct_predictions,
      ROUND(
        CAST(SUM(CASE WHEN p.predicted_winner = r.winner THEN 1 ELSE 0 END) AS FLOAT) /
        COUNT(p.id) * 100,
        2
      ) as accuracy_percentage
    FROM groups g
    JOIN classes c ON g.class_id = c.id
    LEFT JOIN predictions p ON g.id = p.group_id
    LEFT JOIN results r ON p.game_id = r.game_id
    WHERE r.winner IS NOT NULL
    GROUP BY g.id, g.name, c.name, g.class_id
    ORDER BY c.name, accuracy_percentage DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ stats: rows });
  });
});

app.listen(PORT, () => {
  console.log(`NBA Predictions Tracker running on http://localhost:${PORT}`);
});
