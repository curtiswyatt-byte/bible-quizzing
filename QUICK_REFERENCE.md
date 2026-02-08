# Angular Bible Quizzing - Quick Reference Guide

## File Structure Overview

```
bible-quizzing-angular/
│
├── src/app/
│   ├── components/              # All UI components
│   │   ├── main-menu/           ✓ Complete
│   │   ├── player-entry/        ✓ Functional
│   │   ├── question-entry/      ✓ Functional
│   │   ├── team-setup/          ✓ Functional
│   │   ├── user-file/           ✓ Complete
│   │   ├── match-settings/      ✓ Complete
│   │   ├── data-library/        ✓ Complete
│   │   ├── data-import/         ✓ Complete
│   │   ├── match-setup/         ◐ Partial
│   │   ├── select-question/     ◐ Partial
│   │   ├── select-teams/        ◐ Partial
│   │   ├── quiz-session/        ◐ Partial (Complex)
│   │   └── statistics/          ◐ Partial
│   │
│   ├── services/                # Business logic
│   │   ├── database.service.ts          ✓ Complete
│   │   ├── quiz-state.service.ts        ✓ Complete
│   │   ├── match-settings.service.ts    ✓ Complete
│   │   ├── data-import.service.ts       ✓ Complete
│   │   ├── direct-data-loader.service.ts ✓ Complete
│   │   ├── dataset-catalog.service.ts   ✓ Complete
│   │   └── data-migration.ts (util)     ✓ Complete
│   │
│   ├── models/                  # TypeScript interfaces
│   │   ├── player.model.ts      ✓ Complete
│   │   ├── match-settings.model.ts ✓ Complete
│   │   └── dataset-info.model.ts ✓ Complete
│   │
│   ├── app.routes.ts            ✓ Complete (14 routes)
│   ├── app.ts                   ✓ Complete
│   ├── app.config.ts            ✓ Complete
│   └── styles.css               ✓ Complete
│
├── public/datasets/             # Data files
│   └── catalog.json             
│
├── package.json                 ✓ Dependencies
├── angular.json                 ✓ Build config
├── tsconfig.json                ✓ TypeScript config
│
└── Documentation files:
    ├── ANGULAR_ANALYSIS.md      <- Detailed analysis (NEW)
    ├── PROJECT_SUMMARY.md
    ├── IMPLEMENTATION_STATUS.md
    ├── MIGRATION_GUIDE.md
    ├── README.md
    └── QUICK_START.md
```

## Component Checklist

### Fully Working (Can be used as-is)
- [ ] Main Menu
- [ ] Match Settings
- [ ] User File Configuration
- [ ] Data Library (Dataset selection)
- [ ] Data Import (JSON/CSV)

### Partially Working (Need feature completion)
- [ ] Player Entry (CRUD works, needs testing)
- [ ] Question Entry (CRUD works, needs testing)
- [ ] Team Setup (CRUD works, needs testing)
- [ ] Match Setup (UI exists, needs match init logic)
- [ ] Select Question (UI exists, needs match logic)
- [ ] Select Teams (UI exists, needs match init)
- [ ] Quiz Session (Display exists, needs game logic)
- [ ] Statistics (Structure exists, needs data logic)

## Database Schema

### 12 Object Stores
1. **players** - Player registry
2. **teams** - Team membership
3. **questionDetail** - Question bank
4. **questionSelect** - Question metadata
5. **quizSet** - Question set definitions
6. **verses** - Bible verse text
7. **types** - Question types
8. **parms** - Match parameters
9. **matchSummary** - Match records
10. **matchDetail** - Question-by-question records
11. **matchStats** - Player statistics
12. **userFile** - App configuration

## Key Services

| Service | Purpose | Storage | Status |
|---------|---------|---------|--------|
| DatabaseService | CRUD for all data | IndexedDB | 100% |
| QuizStateService | Match state mgmt | SessionStorage | 100% |
| MatchSettingsService | Match rules | LocalStorage | 100% |
| DataImportService | Import data | (orchestrator) | 100% |
| DirectDataLoaderService | Load datasets | (orchestrator) | 100% |
| DatasetCatalogService | List datasets | HTTP cache | 100% |

## Component Data Dependencies

```
Main Menu
├── DatabaseService.getUserFile()
└── Router

User File Component
├── DatabaseService.getUserFile()
├── DatabaseService.saveUserFile()
└── Router

Match Settings Component
├── MatchSettingsService
└── Router

Player Entry Component
├── DatabaseService (all player methods)
└── Router

Question Entry Component
├── DatabaseService (question/type methods)
└── Router

Team Setup Component
├── DatabaseService (team methods)
└── Router

Select Question Component
├── DatabaseService.getAllQuizSets()
├── DatabaseService.getQuizSet()
├── QuizStateService
├── MatchSettingsService
└── Router

Select Teams Component
├── DatabaseService.getAllTeams()
├── DatabaseService.getTeamMembers()
├── DatabaseService.getPlayer()
├── QuizStateService
├── MatchSettingsService
└── Router

Match Setup Component
├── DatasetCatalogService
├── DirectDataLoaderService
├── DatabaseService (get teams, players, questions)
├── MatchSettingsService
├── QuizStateService
└── Router

Quiz Session Component (Complex)
├── DatabaseService (all methods)
├── QuizStateService
├── MatchSettingsService
└── Router

Statistics Component
├── DatabaseService (match data)
└── Router

Data Library Component
├── DatasetCatalogService
├── DirectDataLoaderService
└── Router

Data Import Component
├── DataImportService
└── Router
```

## Data Flow in Quiz Session

```
1. User navigates to Match Setup
   ↓
2. Select Dataset → Load via DirectDataLoaderService
   ↓
3. Select Quiz Set → Query DatabaseService.getAllQuizSets()
   ↓
4. Select Teams (via Select Teams) → Get players for each team
   ↓
5. Chair Assignment (4 per team) → Build Team Chairs array
   ↓
6. Initialize MatchState → QuizStateService.setMatchState()
   ↓
7. Navigate to Quiz Session
   ↓
8. Quiz Session restores state from QuizStateService
   ↓
9. Load Questions, Verses, Types from state/database
   ↓
10. Question-by-question:
    - Display question (from questionBank)
    - Display verse (from verseMap)
    - Record player actions
    - Update score
    - Save MatchDetail
    ↓
11. Match completion:
    - Save MatchSummary
    - Save MatchStats for each player
    - Clear QuizStateService
```

## Key State Objects

### MatchState (stored in SessionStorage)
```typescript
{
  quizID: "Quiz-001",
  matchID: "Match-A-vs-B",
  team1Team: "Team A",
  team2Team: "Team B",
  team1Score: 0,
  team2Score: 0,
  team1Chairs: [ { playerNumber: 1, name: "Player 1" }, ... ],
  team2Chairs: [ { playerNumber: 5, name: "Player 5" }, ... ],
  setID: "set-001",
  currentQuestionID: 100,
  bonusQuestion: false,
  matchSettings: { timeoutsPerTeam: 2, ... },
  questionBank: [ { questionID: 100, ... }, ... ],
  questionLookupEntries: [ [100, {...}], ... ],
  verseLookupEntries: [ ["3:16", "For God so loved..."], ... ],
  questionTypeEntries: [ ["IC", { leadIn: "an Incomplete Chapter" }], ... ]
}
```

### MatchSettings (stored in LocalStorage)
```typescript
{
  timeoutsPerTeam: 2,
  answerTimeSeconds: 30,
  speakWaitSeconds: 3,
  timeoutDurationSeconds: 60,
  quizOutCorrect: 4,
  quizOutBonusPoints: 10,
  errorOutMisses: 3,
  errorOutPenaltyPoints: 10,
  bonusQuestionPoints: 10
}
```

## Routes & Navigation

| Route | Component | Status | Next Route |
|-------|-----------|--------|-----------|
| / | Main Menu | Complete | Any |
| /player-entry | Player Entry | Functional | / |
| /question-entry | Question Entry | Functional | / |
| /team-setup | Team Setup | Functional | / |
| /user-file | User File | Complete | / |
| /match-settings | Match Settings | Complete | / |
| /data-library | Data Library | Complete | / |
| /data-import | Data Import | Complete | / |
| /match-setup | Match Setup | Partial | /select-teams |
| /select-question | Select Question | Partial | /quiz-session |
| /select-teams | Select Teams | Partial | /match-setup |
| /quiz-session | Quiz Session | Partial | /statistics |
| /statistics | Statistics | Partial | / |

## Testing Checklist

### Data Entry (CRUD)
- [ ] Add player → appears in list
- [ ] Edit player → changes saved
- [ ] Delete player → removed from list
- [ ] Add question → appears in list
- [ ] Edit question → changes saved
- [ ] Delete question → removed from list
- [ ] Create team → appears in list
- [ ] Add player to team → member list updates
- [ ] Remove player from team → member list updates
- [ ] Rename team → all players still in team

### Data Import
- [ ] Import JSON file
- [ ] Import CSV players
- [ ] Import CSV questions
- [ ] Import CSV verses
- [ ] Auto-import from /exported-data/import-data.json

### Match Flow
- [ ] Select dataset → data loads
- [ ] Select quiz set → questions appear
- [ ] Select teams → members populate
- [ ] Assign chairs → teams show selections
- [ ] Navigate to quiz → current state preserved
- [ ] Display question → verse text shows
- [ ] Timer works → starts/stops correctly
- [ ] Chair selection → updates team display

### Settings
- [ ] Change match settings → saves to storage
- [ ] Close and reopen → settings persist
- [ ] Reset to defaults → values change

## Common Patterns

### Adding a new component
```typescript
// 1. Create component
ng generate component components/my-component --standalone

// 2. Add to routes
{
  path: 'my-route',
  loadComponent: () => import('./components/my-component/my-component.component')
    .then(m => m.MyComponentComponent)
}

// 3. Inject services
constructor(
  private dbService: DatabaseService,
  private router: Router
) {}

// 4. Load data in ngOnInit
async ngOnInit() {
  this.data = await this.dbService.someMethod();
}

// 5. Save data with error handling
async onSave() {
  try {
    await this.dbService.saveData(this.form);
    alert('Saved!');
    this.router.navigate(['/']);
  } catch (error) {
    alert('Error: ' + error.message);
  }
}
```

### Using state service
```typescript
// Set state
const state: MatchState = { ... };
this.quizState.setMatchState(state);

// Get state
const state = this.quizState.getMatchState();

// Subscribe to changes
this.quizState.matchState$.subscribe(state => {
  // Update UI
});

// Reset
this.quizState.resetMatch();
```

### Loading data with progress
```typescript
this.importService.progress$.subscribe(progress => {
  console.log(`${progress.stepName}: ${progress.percentage}%`);
});
```

## Performance Considerations

1. **IndexedDB Queries**: All async, don't block UI
2. **Large Arrays**: Used maps for O(1) lookups (questionLookup)
3. **Lazy Loading**: All routes are lazy-loaded
4. **Batch Operations**: Use batchAddPlayers, batchAddQuestions for imports
5. **Memory**: Question bank and verse maps stored in MatchState (reused)

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- IndexedDB: Required

## Deployment

```bash
# Development
npm start

# Production build
npm run build
# Output: dist/bible-quizzing-angular/

# Testing
npm test
```

## Known Issues & TODO

1. Quiz Session is only 35% implemented - needs game logic
2. Statistics component needs aggregation logic
3. No error boundaries in components
4. No comprehensive testing suite
5. No multi-tab synchronization
6. No offline-first PWA features

## Contact & Support

All code follows Angular best practices and TypeScript strict mode.
See ANGULAR_ANALYSIS.md for comprehensive documentation.

