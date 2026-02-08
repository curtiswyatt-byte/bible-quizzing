# Bible Quizzing Angular Application

A modern, responsive Angular application for Bible Quizzing, migrated from the original VB6 application. This application maintains all features and data from the original program while providing a modern web-based interface.

## Features

- **Player Management**: Add, edit, and delete players
- **Question Entry**: Create and manage quiz questions
- **Team Setup**: Organize players into teams
- **Quiz Session**: Conduct live quiz matches with full scoring
- **Statistics**: View team and player statistics
- **Database Management**: Import and manage quiz data

## Technology Stack

- Angular 20+
- TypeScript
- IndexedDB (client-side database)
- Responsive CSS (no Tailwind)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Navigate to the project directory:
```bash
cd bible-quizzing-angular
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:4200`

## Data Migration

The original application used Microsoft Access (.mdb) databases. To migrate your data:

1. **Manual Entry**: Use the application's UI to enter data manually
2. **CSV Import**: Export data from Access to CSV and use the migration utility
3. **Database Tools**: Use tools like MDB Explorer or similar to extract data

### Migration Utility

The application includes a data migration utility at `src/app/utils/data-migration.ts`. This can be used to import data programmatically.

## Application Structure

```
src/app/
├── components/          # Angular components
│   ├── main-menu/       # Main navigation
│   ├── player-entry/    # Player management
│   ├── question-entry/  # Question management
│   ├── team-setup/      # Team management
│   ├── quiz-session/    # Live quiz interface
│   ├── statistics/      # Statistics viewing
│   └── ...
├── models/              # TypeScript models/interfaces
├── services/            # Business logic services
│   ├── database.service.ts
│   └── quiz-state.service.ts
└── utils/               # Utility functions
```

## Database Schema

The application uses IndexedDB with the following object stores:

- `players`: Player information
- `teams`: Team membership
- `questionDetail`: Question content
- `questionSelect`: Question selection metadata
- `quizSet`: Question sets for matches
- `verses`: Bible verse text
- `types`: Question types
- `parms`: Match parameters
- `matchSummary`: Match results
- `matchDetail`: Detailed match actions
- `matchStats`: Player statistics per match
- `userFile`: Application configuration

## Styling

The application uses a custom CSS theme based on XL Ministries branding:
- Primary colors: Blue (#1E3A8A, #3B82F6) and Gold (#F59E0B, #FCD34D)
- Responsive design with mobile-first approach
- No external CSS frameworks (no Tailwind)

## Features Matching Original Application

✅ All screens from VB6 application
✅ All database tables and relationships
✅ Player entry and management
✅ Question entry and management
✅ Team setup and management
✅ Quiz session with scoring
✅ Statistics viewing
✅ User file configuration
✅ Team color customization

## Development

### Build for Production

```bash
npm run build
```

### Run Tests

```bash
npm test
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Notes

- All data is stored locally in the browser using IndexedDB
- No server required - fully client-side application
- Data persists across browser sessions
- Backup functionality available through browser's data export

## License

Copyright 1997, 1998 Roberts Johnson
Published by: XL Ministries, Inc.
All Rights Reserved.
