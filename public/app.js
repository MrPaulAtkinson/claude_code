const API_BASE = 'http://localhost:3000/api';

let classes = [];
let groups = [];
let currentGames = [];
let currentResultsGames = [];
let currentResultsPredictions = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeDateInputs();
  initMrPaul(); // Initialize Mr. Paul class and groups
  loadClasses();
  loadGroups();
  loadStats();

  // Event listeners
  document.getElementById('load-games-btn').addEventListener('click', loadGames);
  document.getElementById('save-predictions-btn').addEventListener('click', savePredictions);
  document.getElementById('load-results-btn').addEventListener('click', loadResults);
  document.getElementById('add-class-btn').addEventListener('click', addClass);
  document.getElementById('add-group-btn').addEventListener('click', addGroup);

  // Results filter listener
  document.getElementById('results-class-filter').addEventListener('change', () => {
    if (currentResultsGames.length > 0) {
      displayResults(currentResultsGames, currentResultsPredictions);
    }
  });
});

// Tab switching
function initializeTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all tabs
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).classList.add('active');

      // Reload data for specific tabs
      if (btn.getAttribute('data-tab') === 'stats') {
        loadStats();
      } else if (btn.getAttribute('data-tab') === 'groups') {
        loadClasses();
        loadGroups();
      }
    });
  });
}

// Initialize Mr. Paul class with automatic prediction groups
async function initMrPaul() {
  try {
    await fetch(`${API_BASE}/init-mr-paul`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.log('Could not initialize Mr. Paul class:', error);
  }
}

// Initialize date inputs to today
function initializeDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('predictions-date').value = today;
  document.getElementById('results-date').value = today;
}

// Load classes from API
async function loadClasses() {
  try {
    const response = await fetch(`${API_BASE}/classes`);
    const data = await response.json();
    classes = data.classes;
    displayClasses();
    updateClassSelectors();
  } catch (error) {
    console.error('Error loading classes:', error);
    showMessage('Error loading classes', 'error');
  }
}

// Display classes in the classes tab
function displayClasses() {
  console.log('displayClasses called - Version 2.0 with Edit/Delete');
  const container = document.getElementById('classes-list');

  if (classes.length === 0) {
    container.innerHTML = '<p class="info-message">No classes yet. Add your first class above!</p>';
    return;
  }

  container.innerHTML = '<div class="classes-grid">' + classes.map(cls => `
    <div class="class-card">
      <div class="card-name">${cls.name}</div>
      <div class="card-actions">
        <button class="edit-btn" onclick="editClass(${cls.id}, '${cls.name.replace(/'/g, "\\'")}')">✏️</button>
        <button class="delete-btn" onclick="deleteClass(${cls.id}, '${cls.name.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    </div>
  `).join('') + '</div>';
  console.log('Classes HTML generated:', container.innerHTML.substring(0, 200));
}

// Update class selector dropdowns
function updateClassSelectors() {
  const groupClassSelector = document.getElementById('group-class-selector');
  const predictionsClassFilter = document.getElementById('predictions-class-filter');
  const resultsClassFilter = document.getElementById('results-class-filter');

  // Update group creation selector
  if (classes.length === 0) {
    groupClassSelector.innerHTML = '<option value="">No classes available - add one first</option>';
  } else {
    groupClassSelector.innerHTML = '<option value="">Select a class</option>' +
      classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('');
  }

  // Update predictions filter
  predictionsClassFilter.innerHTML = '<option value="">All Classes</option>' +
    classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('');

  // Update results filter
  resultsClassFilter.innerHTML = '<option value="">All Classes</option>' +
    classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('');
}

// Add a new class
async function addClass() {
  const input = document.getElementById('new-class-name');
  const name = input.value.trim();

  if (!name) {
    showMessage('Please enter a class name', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (response.ok) {
      input.value = '';
      await loadClasses();
      showMessage('Class added successfully!', 'success');
    } else {
      const error = await response.json();
      showMessage(error.error || 'Failed to add class', 'error');
    }
  } catch (error) {
    console.error('Error adding class:', error);
    showMessage('Error adding class', 'error');
  }
}

// Edit a class
async function editClass(id, currentName) {
  const newName = prompt('Enter new class name:', currentName);

  if (!newName || newName === currentName) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/classes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });

    if (response.ok) {
      await loadClasses();
      await loadGroups();
      showMessage('Class renamed successfully!', 'success');
    } else {
      const error = await response.json();
      showMessage(error.error || 'Failed to rename class', 'error');
    }
  } catch (error) {
    console.error('Error renaming class:', error);
    showMessage('Error renaming class', 'error');
  }
}

// Delete a class
async function deleteClass(id, name) {
  if (!confirm(`Delete class "${name}"?\n\nNote: You must delete all groups in this class first.`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/classes/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await loadClasses();
      await loadGroups();
      showMessage('Class deleted successfully!', 'success');
    } else {
      const error = await response.json();
      showMessage(error.error || 'Failed to delete class', 'error');
    }
  } catch (error) {
    console.error('Error deleting class:', error);
    showMessage('Error deleting class', 'error');
  }
}

// Load groups from API
async function loadGroups() {
  try {
    const response = await fetch(`${API_BASE}/groups`);
    const data = await response.json();
    groups = data.groups;
    displayGroups();
  } catch (error) {
    console.error('Error loading groups:', error);
    showMessage('Error loading groups', 'error');
  }
}

// Display groups in the groups tab
function displayGroups() {
  const container = document.getElementById('groups-list');

  if (groups.length === 0) {
    container.innerHTML = '<p class="info-message">No groups yet. Add your first group above!</p>';
    return;
  }

  // Organize groups by class
  const groupsByClass = {};
  groups.forEach(group => {
    if (!groupsByClass[group.class_id]) {
      groupsByClass[group.class_id] = [];
    }
    groupsByClass[group.class_id].push(group);
  });

  let html = '';
  classes.forEach(cls => {
    const classGroups = groupsByClass[cls.id] || [];
    if (classGroups.length > 0) {
      html += `
        <div class="class-section">
          <h4>${cls.name}</h4>
          <div class="groups-grid">
            ${classGroups.map(group => `
              <div class="group-card">
                <div class="card-name">${group.name}</div>
                <div class="card-actions">
                  <button class="edit-btn" onclick="editGroup(${group.id}, '${group.name.replace(/'/g, "\\'")}')">✏️</button>
                  <button class="delete-btn" onclick="deleteGroup(${group.id}, '${group.name.replace(/'/g, "\\'")}')">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  });

  container.innerHTML = html || '<p class="info-message">No groups yet. Add your first group above!</p>';
}

// Add a new group
async function addGroup() {
  const input = document.getElementById('new-group-name');
  const classSelector = document.getElementById('group-class-selector');
  const name = input.value.trim();
  const classId = parseInt(classSelector.value);

  if (!name) {
    showMessage('Please enter a group name', 'error');
    return;
  }

  if (!classId) {
    showMessage('Please select a class', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, classId })
    });

    if (response.ok) {
      input.value = '';
      classSelector.value = '';
      await loadGroups();
      showMessage('Group added successfully!', 'success');
    } else {
      const error = await response.json();
      showMessage(error.error || 'Failed to add group', 'error');
    }
  } catch (error) {
    console.error('Error adding group:', error);
    showMessage('Error adding group', 'error');
  }
}

// Edit a group
async function editGroup(id, currentName) {
  const newName = prompt('Enter new group name:', currentName);

  if (!newName || newName === currentName) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });

    if (response.ok) {
      await loadGroups();
      showMessage('Group renamed successfully!', 'success');
    } else {
      const error = await response.json();
      showMessage(error.error || 'Failed to rename group', 'error');
    }
  } catch (error) {
    console.error('Error renaming group:', error);
    showMessage('Error renaming group', 'error');
  }
}

// Delete a group
async function deleteGroup(id, name) {
  try {
    // First try normal delete to check for predictions
    const response = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await loadGroups();
      showMessage('Group deleted successfully!', 'success');
    } else {
      const error = await response.json();

      // If group has predictions, ask for confirmation
      if (error.hasPredictions) {
        if (confirm(`Delete group "${name}"?\n\nThis group has ${error.count} prediction(s).\nAll predictions will be permanently deleted.\n\nContinue?`)) {
          // Force delete with predictions
          const forceResponse = await fetch(`${API_BASE}/groups/${id}/force`, {
            method: 'DELETE'
          });

          if (forceResponse.ok) {
            await loadGroups();
            showMessage('Group and all predictions deleted successfully!', 'success');
          } else {
            showMessage('Failed to delete group', 'error');
          }
        }
      } else {
        showMessage(error.error || 'Failed to delete group', 'error');
      }
    }
  } catch (error) {
    console.error('Error deleting group:', error);
    showMessage('Error deleting group', 'error');
  }
}

// Load games for selected date
async function loadGames() {
  const date = document.getElementById('predictions-date').value;

  if (!date) {
    showMessage('Please select a date', 'error');
    return;
  }

  if (groups.length === 0) {
    showMessage('Please add groups first in the "Manage Groups" tab', 'error');
    return;
  }

  const container = document.getElementById('games-container');
  container.innerHTML = '<p class="info-message">Loading games...</p>';

  try {
    const response = await fetch(`${API_BASE}/games/${date}`);
    const data = await response.json();
    currentGames = data.games;

    if (currentGames.length === 0) {
      container.innerHTML = '<p class="info-message">No games scheduled for this date.</p>';
      document.getElementById('predictions-form-container').style.display = 'none';
      return;
    }

    // Auto-generate Mr. Paul predictions
    try {
      await fetch(`${API_BASE}/auto-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ games: currentGames, date })
      });
    } catch (autoError) {
      console.log('Could not generate auto predictions:', autoError);
    }

    // Load existing predictions for this date (including Mr. Paul's)
    const predsResponse = await fetch(`${API_BASE}/predictions/${date}`);
    const predsData = await predsResponse.json();
    const existingPredictions = predsData.predictions || [];

    displayGamesForPredictions(currentGames, existingPredictions);
    document.getElementById('predictions-form-container').style.display = 'block';
  } catch (error) {
    console.error('Error loading games:', error);
    container.innerHTML = '<p class="error-message">Failed to load games. Please try again.</p>';
  }
}

// Display games with prediction dropdowns
function displayGamesForPredictions(games, existingPredictions) {
  const container = document.getElementById('games-container');
  const classFilter = document.getElementById('predictions-class-filter').value;

  // Filter groups by selected class
  let filteredGroups = groups;
  if (classFilter) {
    filteredGroups = groups.filter(g => g.class_id == classFilter);
  }

  if (filteredGroups.length === 0) {
    container.innerHTML = '<p class="info-message">No groups in the selected class. Please add groups first.</p>';
    return;
  }

  container.innerHTML = games.map(game => {
    // Group predictions by class
    const groupsByClass = {};
    filteredGroups.forEach(group => {
      if (!groupsByClass[group.class_id]) {
        groupsByClass[group.class_id] = [];
      }
      groupsByClass[group.class_id].push(group);
    });

    let gamePredictions = '';

    // Show class headers if viewing all classes
    if (!classFilter) {
      classes.forEach(cls => {
        const classGroups = groupsByClass[cls.id] || [];
        if (classGroups.length > 0) {
          gamePredictions += `<div class="class-header">${cls.name}</div>`;
          classGroups.forEach(group => {
            const existing = existingPredictions.find(
              p => p.game_id == game.id && p.group_id === group.id
            );
            const selected = existing ? existing.predicted_winner : '';

            gamePredictions += `
              <div class="prediction-item">
                <label>${group.name}</label>
                <select data-game-id="${game.id}" data-group-id="${group.id}">
                  <option value="">Select Winner</option>
                  <option value="${game.homeTeam}" ${selected === game.homeTeam ? 'selected' : ''}>
                    ${game.homeTeam}
                  </option>
                  <option value="${game.awayTeam}" ${selected === game.awayTeam ? 'selected' : ''}>
                    ${game.awayTeam}
                  </option>
                </select>
              </div>
            `;
          });
        }
      });
    } else {
      // Just show groups without class headers when filtered
      filteredGroups.forEach(group => {
        const existing = existingPredictions.find(
          p => p.game_id == game.id && p.group_id === group.id
        );
        const selected = existing ? existing.predicted_winner : '';

        gamePredictions += `
          <div class="prediction-item">
            <label>${group.name}</label>
            <select data-game-id="${game.id}" data-group-id="${group.id}">
              <option value="">Select Winner</option>
              <option value="${game.homeTeam}" ${selected === game.homeTeam ? 'selected' : ''}>
                ${game.homeTeam}
              </option>
              <option value="${game.awayTeam}" ${selected === game.awayTeam ? 'selected' : ''}>
                ${game.awayTeam}
              </option>
            </select>
          </div>
        `;
      });
    }

    return `
      <div class="game-card">
        <div class="game-info">
          <div class="teams">
            ${game.awayTeam} @ ${game.homeTeam}
          </div>
          <div class="game-time">
            ${game.status || 'Scheduled'}
          </div>
        </div>
        <div class="predictions-grid">
          ${gamePredictions}
        </div>
      </div>
    `;
  }).join('');

  // Set up keyboard shortcuts for faster data entry
  setupKeyboardShortcuts();
}

// Setup keyboard shortcuts for prediction dropdowns
function setupKeyboardShortcuts() {
  const selects = document.querySelectorAll('#games-container select');

  selects.forEach((select, index) => {
    select.addEventListener('keydown', (e) => {
      // Arrow Up: Select first option (home team)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        select.selectedIndex = 1; // Index 1 is first team (0 is "Select Winner")
      }
      // Arrow Down: Select second option (away team)
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        select.selectedIndex = 2; // Index 2 is second team
      }
      // Home key: Select home team (H key)
      else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        select.selectedIndex = 1;
      }
      // Away team (A key)
      else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        select.selectedIndex = 2;
      }
      // Space: Toggle between teams
      else if (e.key === ' ') {
        e.preventDefault();
        if (select.selectedIndex === 0 || select.selectedIndex === 2) {
          select.selectedIndex = 1; // Select home if nothing or away selected
        } else {
          select.selectedIndex = 2; // Select away if home selected
        }
      }
      // Tab or Enter: Move to next select
      else if (e.key === 'Enter') {
        e.preventDefault();
        const nextSelect = selects[index + 1];
        if (nextSelect) {
          nextSelect.focus();
        } else {
          // If last select, focus on save button
          document.getElementById('save-predictions-btn').focus();
        }
      }
    });
  });
}

// Save all predictions
async function savePredictions() {
  const date = document.getElementById('predictions-date').value;
  const selects = document.querySelectorAll('#games-container select');
  const predictions = [];

  selects.forEach(select => {
    const gameId = select.getAttribute('data-game-id');
    const groupId = parseInt(select.getAttribute('data-group-id'));
    const predictedWinner = select.value;

    if (predictedWinner) {
      const game = currentGames.find(g => g.id == gameId);
      predictions.push({
        groupId,
        gameId,
        gameDate: date,
        predictedWinner,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam
      });
    }
  });

  if (predictions.length === 0) {
    showMessage('No predictions to save', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictions })
    });

    if (response.ok) {
      showMessage('Predictions saved successfully!', 'success');
    } else {
      showMessage('Failed to save predictions', 'error');
    }
  } catch (error) {
    console.error('Error saving predictions:', error);
    showMessage('Error saving predictions', 'error');
  }
}

// Load and display results for a date
async function loadResults() {
  const date = document.getElementById('results-date').value;

  if (!date) {
    showMessage('Please select a date', 'error');
    return;
  }

  const container = document.getElementById('results-container');
  container.innerHTML = '<p class="info-message">Loading results...</p>';

  try {
    // Fetch games with results
    const gamesResponse = await fetch(`${API_BASE}/games/${date}`);
    const gamesData = await gamesResponse.json();
    const games = gamesData.games.filter(g => g.winner); // Only completed games

    if (games.length === 0) {
      container.innerHTML = '<p class="info-message">No completed games for this date.</p>';
      return;
    }

    // Fetch predictions for this date
    const predsResponse = await fetch(`${API_BASE}/predictions/${date}`);
    const predsData = await predsResponse.json();
    const predictions = predsData.predictions || [];

    // Save results to database
    const results = games.map(g => ({
      gameId: g.id,
      gameDate: date,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      winner: g.winner,
      homeScore: g.homeScore,
      awayScore: g.awayScore
    }));

    await fetch(`${API_BASE}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results })
    });

    // Store for filtering
    currentResultsGames = games;
    currentResultsPredictions = predictions;

    displayResults(games, predictions);
  } catch (error) {
    console.error('Error loading results:', error);
    container.innerHTML = '<p class="error-message">Failed to load results. Please try again.</p>';
  }
}

// Display results in a table
function displayResults(games, predictions) {
  const container = document.getElementById('results-container');
  const selectedClassId = document.getElementById('results-class-filter').value;

  // Filter groups based on selected class
  let filteredGroups = groups;
  if (selectedClassId) {
    filteredGroups = groups.filter(g => g.class_id == selectedClassId);
  }

  if (filteredGroups.length === 0) {
    container.innerHTML = '<p class="info-message">No groups in the selected class.</p>';
    return;
  }

  let html = '<div class="table-scroll-container"><table class="results-table"><thead><tr>';
  html += '<th>Game</th><th>Score</th><th>Winner</th>';

  // Group column headers by class (only for filtered groups)
  if (selectedClassId) {
    // Single class selected - show groups without class labels
    filteredGroups.forEach(group => {
      html += `<th>${group.name}</th>`;
    });
  } else {
    // All classes - show with class labels
    classes.forEach(cls => {
      const classGroups = filteredGroups.filter(g => g.class_id === cls.id);
      if (classGroups.length > 0) {
        classGroups.forEach(group => {
          html += `<th><div class="group-class-label">${cls.name}</div>${group.name}</th>`;
        });
      }
    });
  }

  html += '</tr></thead><tbody>';

  games.forEach(game => {
    html += '<tr>';
    html += `<td>${game.awayTeam} @ ${game.homeTeam}</td>`;
    html += `<td class="score">${game.awayScore} - ${game.homeScore}</td>`;
    html += `<td class="winner">${game.winner}</td>`;

    if (selectedClassId) {
      // Single class selected
      filteredGroups.forEach(group => {
        const pred = predictions.find(p => p.game_id == game.id && p.group_id === group.id);
        if (pred) {
          const isCorrect = pred.predicted_winner === game.winner;
          html += `<td class="${isCorrect ? 'correct' : 'incorrect'}">
            ${pred.predicted_winner} ${isCorrect ? '✓' : '✗'}
          </td>`;
        } else {
          html += '<td>-</td>';
        }
      });
    } else {
      // All classes
      classes.forEach(cls => {
        const classGroups = filteredGroups.filter(g => g.class_id === cls.id);
        classGroups.forEach(group => {
          const pred = predictions.find(p => p.game_id == game.id && p.group_id === group.id);
          if (pred) {
            const isCorrect = pred.predicted_winner === game.winner;
            html += `<td class="${isCorrect ? 'correct' : 'incorrect'}">
              ${pred.predicted_winner} ${isCorrect ? '✓' : '✗'}
            </td>`;
          } else {
            html += '<td>-</td>';
          }
        });
      });
    }

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// Load and display statistics
async function loadStats() {
  const container = document.getElementById('stats-container');
  container.innerHTML = '<p class="info-message">Loading statistics...</p>';

  try {
    const response = await fetch(`${API_BASE}/stats`);
    const data = await response.json();
    const stats = data.stats;

    if (stats.length === 0 || !stats.some(s => s.total_predictions > 0)) {
      container.innerHTML = '<p class="info-message">No prediction data yet. Make some predictions and check back!</p>';
      return;
    }

    displayStats(stats);
  } catch (error) {
    console.error('Error loading stats:', error);
    container.innerHTML = '<p class="error-message">Failed to load statistics.</p>';
  }
}

// Display statistics cards
function displayStats(stats) {
  const container = document.getElementById('stats-container');

  // Organize stats by class
  const statsByClass = {};
  stats.forEach(stat => {
    if (!statsByClass[stat.class_id]) {
      statsByClass[stat.class_id] = [];
    }
    statsByClass[stat.class_id].push(stat);
  });

  let html = '';
  classes.forEach(cls => {
    const classStats = statsByClass[cls.id] || [];
    if (classStats.length > 0) {
      html += `
        <div class="stats-class-section">
          <h3>${cls.name}</h3>
          <div class="stats-grid">
            ${classStats.map(stat => {
              const accuracy = stat.accuracy_percentage || 0;
              const total = stat.total_predictions || 0;
              const correct = stat.correct_predictions || 0;

              return `
                <div class="stat-card">
                  <h4>${stat.name}</h4>
                  <div class="accuracy">${accuracy.toFixed(1)}%</div>
                  <div class="details">
                    ${correct} / ${total} correct predictions
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

// Show message to user
function showMessage(message, type) {
  const className = type === 'success' ? 'success-message' : 'error-message';
  const messageDiv = document.createElement('div');
  messageDiv.className = className;
  messageDiv.textContent = message;

  // Try to place message near the save button if it exists
  const saveButtonContainer = document.getElementById('predictions-form-container');
  if (saveButtonContainer && saveButtonContainer.style.display !== 'none') {
    saveButtonContainer.appendChild(messageDiv);
  } else {
    // Otherwise place at top of active tab
    const activeTab = document.querySelector('.tab-content.active');
    activeTab.insertBefore(messageDiv, activeTab.firstChild);
  }

  setTimeout(() => messageDiv.remove(), 3000);
}
