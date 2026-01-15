# NBA Predictions Tracker

A web application to track and compare NBA game predictions from different groups across multiple classes.

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

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

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

## How to Use

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

**Games not loading:**
- Check your internet connection
- The NBA API may have rate limits - wait a minute and try again
- Make sure the date you selected has scheduled games

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
