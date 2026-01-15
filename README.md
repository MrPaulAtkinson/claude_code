# NBA Predictions Tracker

A web application to track and compare NBA game predictions from different groups across multiple classes.

**NEW:** Also includes a mobile-optimized Progressive Web App to view today's NBA games on Prime Video at `/prime`!

## Features

- **Class Organization**: Organize groups by class (e.g., Period 1, Period 2, etc.)
- **Daily Game Tracking**: Automatically fetches NBA games for any date
- **Group Predictions**: Record predictions from multiple groups
- **Class Filtering**: View predictions and results filtered by class
- **Results Comparison**: View predictions vs. actual results
- **Accuracy Statistics**: Track overall prediction accuracy organized by class
- **Clean Interface**: Easy-to-use tabbed interface

## Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)
- NBA API key from balldontlie.io (free)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. **Set up your NBA API key:**

   a. Get a free API key:
   - Visit https://www.balldontlie.io/
   - Sign up for a free account
   - Copy your API key

   b. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

   c. Open `.env` and add your API key:
   ```
   NBA_API_KEY=your_actual_api_key_here
   ```

   **Important:** Never commit your `.env` file to git! It's already in `.gitignore`.

## Running the Application

1. Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

## NBA on Prime Video App

### Quick Start

After starting the server, visit:
```
http://localhost:3000/prime
```

On your phone, open this URL in your mobile browser for a fully optimized mobile experience!

### Features

- **Mobile-First Design**: Beautiful, responsive interface optimized for phones
- **Today's Games**: Automatically shows only games on Prime Video for today
- **Auto-Refresh**: Updates every 2 minutes to show live scores
- **Progressive Web App**: Add to your home screen for an app-like experience
- **One-Tap Access**: Direct links to watch games on Prime Video

### How It Works

The app uses the NBA API to fetch today's games and filters them based on Prime Video's broadcasting schedule (typically Friday nights and special events). When games are live, scores update automatically.

### Mobile Installation

On iPhone:
1. Open the URL in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

On Android:
1. Open the URL in Chrome
2. Tap the menu (⋮)
3. Select "Add to Home screen"

---

## Predictions Tracker

### How to Use

### 1. Set Up Classes

First, create your classes:
- Click on the "Manage Groups" tab
- Under the "Classes" section, enter a class name (e.g., "Period 1", "Period 2", "Math Class A", etc.)
- Click "Add Class"
- Repeat for all your classes

### 2. Set Up Groups

Next, add groups to each class:
- In the "Groups" section of the "Manage Groups" tab
- Select a class from the dropdown
- Enter a group name (e.g., "Group 1", "Team Alpha", etc.)
- Click "Add Group"
- Repeat for all groups in all classes

Note: Group names must be unique within each class, but different classes can have groups with the same name.

### 3. Make Predictions

To record predictions for a day's games:
- Go to the "Today's Predictions" tab
- Select a date (defaults to today)
- (Optional) Filter by a specific class using the dropdown
- Click "Load Games"
- For each game, select the predicted winner for each group
- Click "Save All Predictions"

### 4. View Results

After games are completed:
- Go to the "Previous Results" tab
- Select the date
- Click "Load Results"
- View a table showing each group's predictions organized by class
- Predictions are marked as correct (✓) or incorrect (✗)

### 5. Check Statistics

View overall accuracy:
- Go to the "Group Statistics" tab
- See statistics organized by class
- Each group shows total predictions and accuracy percentage
- Groups are sorted by class and then by accuracy

## API Information

This application uses the free [balldontlie.io](https://www.balldontlie.io/) NBA API to fetch game data. The API provides:
- Game schedules
- Live scores
- Final results

Note: The free tier has rate limits. If you experience issues loading games, wait a moment and try again.

## Data Storage

The application uses SQLite to store:
- Class information
- Group information (linked to classes)
- Predictions for each game
- Game results

All data is stored in `predictions.db` in the root directory.

## Project Structure

```
nba-predictions-tracker/
├── public/
│   ├── index.html      # Main HTML file
│   ├── style.css       # Styling
│   └── app.js          # Frontend JavaScript
├── server.js           # Express backend server
├── database.js         # Database initialization
├── package.json        # Dependencies
└── README.md          # This file
```

## Troubleshooting

**Games not loading ("Unauthorized" or "Failed to load games"):**
- **Most common:** Make sure you've set up your NBA API key in the `.env` file (see Installation step 3)
- Check the server console for error messages about missing API key
- Verify your API key is valid at https://www.balldontlie.io/
- Check your internet connection
- The NBA API may have rate limits - wait a minute and try again
- Make sure the date you selected has scheduled games (try December 25, 2024 for testing)

**Cannot add groups:**
- Ensure you've created at least one class first
- Make sure you've selected a class from the dropdown before adding a group

**Predictions not saving:**
- Ensure you've created at least one class and group first
- Make sure you've selected winners for the games
- Check the browser console for error messages

**Port already in use:**
- If port 3000 is already in use, you can change it in `server.js` by modifying the `PORT` variable

## Future Enhancements

Possible features to add:
- Edit/delete classes and groups
- Class-specific leaderboards
- Point spread predictions
- Historical trend charts
- Export data to CSV
- Mobile-responsive improvements
- User authentication
- Email notifications for game results

## License

ISC
