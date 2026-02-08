# Bible Quizzing Database Schema

This document describes the complete IndexedDB schema for the Bible Quizzing application.

## Database Configuration

- **Database Name:** `BibleQuizzingDB`
- **Current Version:** 5
- **Database Service:** `src/app/services/database.service.ts`

## Tables (Object Stores)

### 1. players

Stores individual player information.

- **Key Path:** `playerNumber`
- **Indices:**
  - `name` (non-unique)
  - `team` (non-unique)

**Structure:**
```typescript
{
  playerNumber: number;    // Primary key
  name: string;
  nickname: string;
  ageGroup: string;
  team: string;            // Team name for quick reference (may be empty)
}
```

**Notes:**
- The `team` field provides quick reference but may be empty
- Official team rosters are maintained in the `teams` table
- Players can exist without team assignments

---

### 2. teams

Stores team roster relationships (normalized structure).

- **Key Path:** `['teamName', 'playerNumber']` (composite key)
- **Indices:**
  - `teamName` (non-unique)

**Structure:**
```typescript
{
  teamName: string;        // Part of composite key
  playerNumber: number;    // Part of composite key
}
```

**Notes:**
- Each record represents ONE player's membership in ONE team
- To get all players on a team: query by `teamName` index
- To get a player's team: query by composite key
- This is a **normalized** many-to-many relationship table
- The `Team` interface in application code aggregates these records

**Example:**
```typescript
// Database records:
{ teamName: "Eagles", playerNumber: 1 }
{ teamName: "Eagles", playerNumber: 2 }
{ teamName: "Lions", playerNumber: 3 }

// Aggregated in memory as:
{
  teamName: "Eagles",
  playerNumbers: [1, 2]
}
```

---

### 3. questionDetail

Stores quiz questions with Bible references.

- **Key Path:** `questionID`
- **Indices:**
  - `qDescType` (non-unique) - Question type (IC, MC, FC, IV, MV, Q)
  - `book` (non-unique) - Bible book
  - `version` (non-unique) - Bible translation

**Structure:**
```typescript
{
  questionID: number;      // Primary key
  qdescription: string;    // Question text
  qAnswer: string;         // Answer text
  qChapter: number;        // Bible chapter
  qBegVerse: number;       // Starting verse
  qEndVerse: number;       // Ending verse
  qDescType: string;       // Question type (IC, MC, FC, IV, MV, Q)
  book: string;            // Bible book (e.g., "James", "1 Corinthians")
  version: string;         // Translation (e.g., "NIV 1984", "ESV")
}
```

**Notes:**
- Questions are indexed by book and version for filtering
- The dataset that generated a question can be inferred from book+version
- Use Question Version Analyzer to fix book/version mismatches

---

### 4. quizSet

Stores which questions belong to which quiz sets.

- **Key Path:** `['setID', 'questNum']` (composite key)
- **Indices:**
  - `setID` (non-unique)

**Structure:**
```typescript
{
  setID: string;           // Quiz set identifier (part of key)
  questNum: number;        // Question number in set (part of key)
  bonusNum: number;        // Bonus question number (or 0)
}
```

**Notes:**
- Each record links ONE question to ONE quiz set
- `questNum` should correspond to a `questionID` in the `questionDetail` table
- Query by `setID` index to get all questions in a quiz set
- The composite key ensures each question appears only once per quiz set

---

### 5. userFile

Stores user configuration and current dataset selection (single record).

- **Key Path:** `id`
- **Indices:** None

**Structure:**
```typescript
{
  id: string;              // Always 'current'
  book: string;
  quizDBname: string;
  quizIDPre: string;
  quizIDNum: string;
  backupDrive: string;
  bookVersion?: string;
  datasetId?: string;
}
```

**Notes:**
- Only ONE record exists with `id: 'current'`
- Stores the currently selected book and version
- Retrieved via `getUserFile()`, saved via `saveUserFile()`

---

### 6. matchSummary

Stores high-level match results.

- **Key Path:** `['quizID', 'matchID']` (composite key)
- **Indices:** None

**Structure:**
```typescript
{
  quizID: string;          // Tournament/quiz identifier (part of key)
  matchID: string;         // Match identifier (part of key)
  team1: string;           // Team 1 name
  team2: string;           // Team 2 name
  score1: number;          // Team 1 score
  score2: number;          // Team 2 score
}
```

**Notes:**
- One record per match
- Links to detailed event history in `matchDetail`
- Links to tournaments via `quizID`

---

### 7. matchDetail

Stores question-by-question match events.

- **Key Path:** `['quizID', 'matchID', 'seqNum']` (composite key)
- **Indices:** None

**Structure:**
```typescript
{
  quizID: string;          // Part of composite key
  matchID: string;         // Part of composite key
  seqNum: number;          // Sequence number (part of key)
  questNum: number;
  questType: string;
  questID: number;
  tm1Player1: number;
  tm1Player2: number;
  tm1Player3: number;
  tm1Player4: number;
  tm2Player1: number;
  tm2Player2: number;
  tm2Player3: number;
  tm2Player4: number;
  actionPlayer: number;
  action: string;
  points: number;
  canceled: boolean;
}
```

**Notes:**
- Multiple records per match (one per question/event)
- `seqNum` orders events chronologically
- Player positions (tm1Player1-4, tm2Player1-4) track who was seated for each question
- `actionPlayer` identifies who answered/acted
- `questID` links to `questionDetail` table

---

### 8. matchStats

Stores per-player statistics for each match.

- **Key Path:** `['playerNumber', 'quizID', 'matchID']` (composite key)
- **Indices:** None

**Structure:**
```typescript
{
  playerNumber: number;    // Part of composite key
  quizID: string;          // Part of composite key
  matchID: string;         // Part of composite key
  activeQuestions: number;
  correct: number;
  errors: number;
  fouls: number;
  bonusCorrect: number;
  bonusErrors: number;
}
```

**Notes:**
- One record per player per match
- Aggregated statistics for reporting
- Links to `players` table via `playerNumber`
- Links to `matchDetail` via `quizID` + `matchID`

---

### 9. tournaments

Stores tournament definitions and brackets.

- **Key Path:** `tournamentID`
- **Indices:**
  - `status` (non-unique)
  - `createdAt` (non-unique)

**Structure:**
```typescript
{
  tournamentID: string;    // Primary key
  name: string;
  format: string;
  teams: string[];
  bracket: any;
  status: 'setup' | 'in-progress' | 'completed';
  createdAt: string;
  currentRound?: number;
  winner?: string;
}
```

**Notes:**
- Manages tournament brackets and progression
- Links to matches via `quizID` in `matchSummary` and `matchDetail`
- Status indexed for filtering active/completed tournaments

---

### 10. verses

Stores Bible verse text.

- **Key Path:** `['chapter', 'verse']` (composite key)
- **Indices:** None

**Structure:**
```typescript
{
  chapter: number;         // Part of composite key
  verse: number;           // Part of composite key
  text: string;            // Verse text
}
```

**Notes:**
- Verse text from the Bible for question generation
- Loaded from dataset JSON files
- One record per verse

---

### 11. types

Stores question type definitions.

- **Key Path:** `typeID`
- **Indices:** None

**Structure:**
```typescript
{
  typeID: string;          // Primary key (IC, MC, FC, IV, MV, Q)
  class: string;           // B (Bible) or Q (Quote)
  leadIn: string;          // Display text (e.g., "an Incomplete Chapter")
}
```

**Notes:**
- Initialized with default types on first database creation
- Types: IC, MC, FC, IV, MV, Q
- Used in question display and filtering

---

### 12. parms

Stores match settings and scoring parameters.

- **Key Path:** `book`
- **Indices:** None

**Structure:**
```typescript
{
  book: string;            // Primary key
  quizOutNum: number;
  errOutNum: number;
  foulOutNum: number;
  timeouts: number;
  matchLength: number;
  quizOutPoints: number;
  errOutPoints: number;
  foulOutPoints: number;
  penaltyNum: number;
  corrPoints: number;
  bonusPoints: number;
  tieBreaker: number;
}
```

**Notes:**
- Match configuration settings per book
- Controls scoring, timeouts, and match flow
- Retrieved when setting up matches

---

### 13. questionSelect

Stores question usage statistics for selection algorithms.

- **Key Path:** `selectionID`
- **Indices:** None

**Structure:**
```typescript
{
  selectionID: number;     // Primary key
  selectType: string;
  selChapter: number;
  selVerse: number;
  primUseCnt: number;
  bonUseCnt: number;
}
```

**Notes:**
- Tracks how often questions have been used
- Helps ensure variety in quiz generation
- Primary and bonus usage tracked separately

---

## Relationships

### Team ↔ Player Relationship

```
players (1)  ←→  (M) teams (M)  ←→  (1) players
```

- **Normalized**: Each team-player relationship is a separate record in `teams`
- **Denormalized**: Players have a `team` field for quick reference (may be stale)
- **Best Practice**: Use `teams` table as source of truth for roster

### Question ↔ QuizSet Relationship

```
questionDetail (1)  ←→  (M) quizSet
```

- Questions can belong to multiple quiz sets
- Quiz sets contain multiple questions
- `quizSet.questNum` should match `questionDetail.questionID`

### Match Hierarchy

```
tournaments (1)  ←→  (M) matchSummary (1)  ←→  (M) matchDetail
                                       ↓
                                   matchStats
```

- Tournaments contain multiple matches
- Each match has one summary and multiple detail records
- Match stats aggregate player performance per match

### Question ↔ Dataset Relationship

```
userFile (current dataset) → questionDetail (filtered by book+version)
```

- Questions are tagged with `book` and `version`
- `userFile` stores the currently active dataset
- Questions can be filtered by book/version indices

---

## Version History

### Version 5 (Current)
- Added `book` and `version` indices to `questionDetail`
- Enabled filtering questions by book and version

### Version 4
- Added `tournaments` table for tournament management

### Earlier Versions
- Base schema with players, teams, questions, matches

---

## Maintenance Notes

### Clearing All Data
```typescript
await databaseService.clearAllData();
```

### Batch Operations
- `batchAddPlayers(players: Player[])`
- `batchAddQuestions(questions: QuestionDetail[])`
- `batchAddVerses(verses: Verse[])`
- `batchAddQuizSets(quizSets: QuizSet[])`

### Database Explorer
Use the Database Explorer (`/database-explorer`) to:
- View all tables and record counts
- Inspect table data
- Export tables as JSON
- Verify schema consistency

---

## Common Queries

### Get all players on a team
```typescript
const playerNumbers = await dbService.getTeamMembers('Eagles');
```

### Get all teams
```typescript
const teamNames = await dbService.getAllTeams();
```

### Get questions for a quiz set
```typescript
const items = await dbService.getQuizSetItems('set-001');
```

### Get questions by book and version
```typescript
const allQuestions = await dbService.getAllQuestions();
const filtered = allQuestions.filter(q =>
  q.book === 'James' && q.version === 'NIV 1984'
);
```

### Get match details
```typescript
const summary = await dbService.getMatchSummary(quizID, matchID);
const details = await dbService.getMatchDetails(quizID, matchID);
```

---

## Important Consistency Rules

1. **Team Rosters**: Always update both `players.team` field AND `teams` table when assigning players to teams
2. **Question IDs**: Ensure `quizSet.questNum` matches valid `questionDetail.questionID`
3. **Match Relationships**: `quizID + matchID` must be consistent across `matchSummary`, `matchDetail`, and `matchStats`
4. **Book/Version**: Questions must have valid `book` and `version` values matching loaded datasets

---

## Troubleshooting

### Problem: Players show no team in database explorer
**Solution**: Check the `teams` table, not just the `team` field in `players`. The `teams` table is the source of truth.

### Problem: Quiz sets show wrong table name
**Solution**: The table is named `quizSet` (singular), not `quizSets` (plural)

### Problem: Questions have wrong book/version
**Solution**: Use the Question Version Analyzer to match questions to their source datasets and update book/version fields

### Problem: Can't find tournaments in database
**Solution**: Tournaments table requires database version 5+. Check `dbVersion` in `database.service.ts`

---

## Schema Diagram

```
┌─────────────┐
│  userFile   │ (current dataset)
└──────┬──────┘
       │
       ▼
┌─────────────────┐      ┌──────────┐
│ questionDetail  │◄─────┤ quizSet  │
└────────┬────────┘      └──────────┘
         │
         │ (questID)
         ▼
┌─────────────────┐      ┌──────────────┐
│  matchDetail    │◄─────┤ matchSummary │
└────────┬────────┘      └──────┬───────┘
         │                      │
         │                      ▼
         │               ┌─────────────┐
         │               │ tournaments │
         │               └─────────────┘
         ▼
┌─────────────┐
│ matchStats  │
└──────┬──────┘
       │ (playerNumber)
       ▼
┌─────────────┐      ┌────────┐
│   players   │◄────►│ teams  │ (roster relationships)
└─────────────┘      └────────┘

Supporting Tables:
┌─────────┐  ┌────────┐  ┌───────┐  ┌───────────────────┐
│ verses  │  │ types  │  │ parms │  │ questionSelect    │
└─────────┘  └────────┘  └───────┘  └───────────────────┘
```
