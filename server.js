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

// The Odds API configuration
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!ODDS_API_KEY) {
  console.warn('⚠️  WARNING: ODDS_API_KEY is not set in .env file. Favorites predictor will not work.');
  console.warn('   Get a free API key from: https://the-odds-api.com/');
}

// Cache for team stats (to avoid repeated API calls)
let teamStatsCache = {
  data: null,
  lastUpdate: null
};

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

// Fetch betting odds from The Odds API
app.get('/api/odds/:date', async (req, res) => {
  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: 'Odds API key not configured' });
  }

  try {
    // The Odds API uses sport key 'basketball_nba'
    const response = await fetch(
      `${ODDS_API_BASE}/sports/basketball_nba/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Odds API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Transform odds data to map team names to favorites
    const oddsMap = {};
    data.forEach(game => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      // Get odds from first bookmaker (usually best available)
      if (game.bookmakers && game.bookmakers.length > 0) {
        const h2hMarket = game.bookmakers[0].markets.find(m => m.key === 'h2h');
        if (h2hMarket && h2hMarket.outcomes) {
          const homeOdds = h2hMarket.outcomes.find(o => o.name === homeTeam);
          const awayOdds = h2hMarket.outcomes.find(o => o.name === awayTeam);

          // Favorite is the team with lower (more negative) odds
          const favorite = homeOdds.price < awayOdds.price ? homeTeam : awayTeam;
          oddsMap[`${awayTeam}_${homeTeam}`] = favorite;
        }
      }
    });

    res.json({ odds: oddsMap });
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({ error: 'Failed to fetch odds data' });
  }
});

// Fetch team stats and calculate point differentials
app.get('/api/team-stats', async (req, res) => {
  // Check cache (refresh every 24 hours)
  if (teamStatsCache.data && teamStatsCache.lastUpdate) {
    const hoursSinceUpdate = (Date.now() - teamStatsCache.lastUpdate) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 24) {
      return res.json({ stats: teamStatsCache.data });
    }
  }

  if (!NBA_API_KEY) {
    return res.status(500).json({ error: 'NBA API key not configured' });
  }

  try {
    // Fetch all teams
    const teamsResponse = await fetch(`${NBA_API_BASE}/teams`, {
      headers: { 'Authorization': NBA_API_KEY }
    });
    const teamsData = await teamsResponse.json();
    const teams = teamsData.data;

    // Calculate point differential for each team from this season's games
    const currentSeason = new Date().getFullYear();
    const seasonStart = `${currentSeason - 1}-10-01`;
    const seasonEnd = `${currentSeason}-06-30`;

    const teamStats = {};

    // Initialize stats for each team
    teams.forEach(team => {
      teamStats[team.full_name] = {
        pointsScored: 0,
        pointsAllowed: 0,
        gamesPlayed: 0,
        differential: 0
      };
    });

    // Fetch games from current season (in batches to avoid rate limits)
    // For simplicity, we'll fetch recent games to calculate differential
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let cursor = 0;
    let hasMore = true;

    while (hasMore && cursor < 1000) { // Limit to prevent infinite loops
      const gamesResponse = await fetch(
        `${NBA_API_BASE}/games?seasons[]=${currentSeason - 1}&per_page=100&cursor=${cursor}`,
        { headers: { 'Authorization': NBA_API_KEY } }
      );

      const gamesData = await gamesResponse.json();
      const games = gamesData.data;

      if (games.length === 0) break;

      games.forEach(game => {
        if (game.home_team_score && game.visitor_team_score) {
          const homeTeam = game.home_team.full_name;
          const awayTeam = game.visitor_team.full_name;

          if (teamStats[homeTeam]) {
            teamStats[homeTeam].pointsScored += game.home_team_score;
            teamStats[homeTeam].pointsAllowed += game.visitor_team_score;
            teamStats[homeTeam].gamesPlayed++;
          }

          if (teamStats[awayTeam]) {
            teamStats[awayTeam].pointsScored += game.visitor_team_score;
            teamStats[awayTeam].pointsAllowed += game.home_team_score;
            teamStats[awayTeam].gamesPlayed++;
          }
        }
      });

      cursor = gamesData.meta?.next_cursor || 0;
      hasMore = cursor > 0;

      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate differential
    Object.keys(teamStats).forEach(team => {
      const stats = teamStats[team];
      if (stats.gamesPlayed > 0) {
        const avgScored = stats.pointsScored / stats.gamesPlayed;
        const avgAllowed = stats.pointsAllowed / stats.gamesPlayed;
        stats.differential = avgScored - avgAllowed;
      }
    });

    // Cache the results
    teamStatsCache.data = teamStats;
    teamStatsCache.lastUpdate = Date.now();

    res.json({ stats: teamStats });
  } catch (error) {
    console.error('Error fetching team stats:', error);
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

// Initialize Mr. Paul class and automatic prediction groups
app.post('/api/init-mr-paul', (req, res) => {
  // First, check if Mr. Paul class exists
  db.get('SELECT id FROM classes WHERE name = ?', ['Mr. Paul'], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let mrPaulClassId;

    const createGroups = (classId) => {
      const groups = ['Home Team', 'Favorites', 'Point Differential'];
      let completed = 0;

      groups.forEach(groupName => {
        db.run(
          'INSERT OR IGNORE INTO groups (class_id, name) VALUES (?, ?)',
          [classId, groupName],
          (err) => {
            if (err && !err.message.includes('UNIQUE')) {
              console.error(`Error creating group ${groupName}:`, err);
            }
            completed++;
            if (completed === groups.length) {
              res.json({ success: true, classId });
            }
          }
        );
      });
    };

    if (row) {
      // Mr. Paul class exists
      createGroups(row.id);
    } else {
      // Create Mr. Paul class
      db.run('INSERT INTO classes (name) VALUES (?)', ['Mr. Paul'], function(err) {
        if (err) {
          return res.status(400).json({ error: 'Failed to create Mr. Paul class' });
        }
        createGroups(this.lastID);
      });
    }
  });
});

// Auto-generate predictions for Mr. Paul groups
app.post('/api/auto-predictions', async (req, res) => {
  const { games, date } = req.body;

  if (!games || !date) {
    return res.status(400).json({ error: 'Games and date are required' });
  }

  try {
    // Get Mr. Paul class and groups
    const mrPaulClass = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM classes WHERE name = ?', ['Mr. Paul'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!mrPaulClass) {
      return res.status(404).json({ error: 'Mr. Paul class not found. Call /api/init-mr-paul first.' });
    }

    const groups = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name FROM groups WHERE class_id = ?',
        [mrPaulClass.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const homeTeamGroup = groups.find(g => g.name === 'Home Team');
    const favoritesGroup = groups.find(g => g.name === 'Favorites');
    const pointDiffGroup = groups.find(g => g.name === 'Point Differential');

    // Fetch odds and team stats
    let oddsMap = {};
    let teamStats = {};

    if (ODDS_API_KEY && favoritesGroup) {
      try {
        const oddsResponse = await fetch(`http://localhost:${PORT}/api/odds/${date}`);
        if (oddsResponse.ok) {
          const oddsData = await oddsResponse.json();
          oddsMap = oddsData.odds || {};
        }
      } catch (e) {
        console.error('Could not fetch odds:', e);
      }
    }

    if (NBA_API_KEY && pointDiffGroup) {
      try {
        const statsResponse = await fetch(`http://localhost:${PORT}/api/team-stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          teamStats = statsData.stats || {};
        }
      } catch (e) {
        console.error('Could not fetch team stats:', e);
      }
    }

    // Generate predictions for each game
    const predictions = [];

    games.forEach(game => {
      // Home Team prediction
      if (homeTeamGroup) {
        predictions.push({
          groupId: homeTeamGroup.id,
          gameId: game.id,
          gameDate: date,
          predictedWinner: game.homeTeam,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam
        });
      }

      // Favorites prediction
      if (favoritesGroup) {
        const key = `${game.awayTeam}_${game.homeTeam}`;
        const favorite = oddsMap[key] || game.homeTeam; // Default to home if no odds
        predictions.push({
          groupId: favoritesGroup.id,
          gameId: game.id,
          gameDate: date,
          predictedWinner: favorite,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam
        });
      }

      // Point Differential prediction
      if (pointDiffGroup) {
        const homeDiff = teamStats[game.homeTeam]?.differential || 0;
        const awayDiff = teamStats[game.awayTeam]?.differential || 0;
        const predicted = homeDiff > awayDiff ? game.homeTeam : game.awayTeam;

        predictions.push({
          groupId: pointDiffGroup.id,
          gameId: game.id,
          gameDate: date,
          predictedWinner: predicted,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam
        });
      }
    });

    // Save predictions to database
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO predictions
      (group_id, game_id, game_date, predicted_winner, home_team, away_team)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    predictions.forEach(pred => {
      insertStmt.run(
        pred.groupId,
        pred.gameId,
        pred.gameDate,
        pred.predictedWinner,
        pred.homeTeam,
        pred.awayTeam
      );
    });

    insertStmt.finalize();

    res.json({ success: true, predictionsGenerated: predictions.length });
  } catch (error) {
    console.error('Error generating auto predictions:', error);
    res.status(500).json({ error: 'Failed to generate auto predictions' });
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

// Get a single group by ID (for prediction links)
app.get('/api/groups/:id', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT g.*, c.name as class_name
    FROM groups g
    JOIN classes c ON g.class_id = c.id
    WHERE g.id = ?
  `;

  db.get(query, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ group: row });
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
