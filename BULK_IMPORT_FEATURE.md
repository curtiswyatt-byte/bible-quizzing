# Bulk Import All Datasets Feature

## Overview

A new feature has been added to import ALL datasets at once, merging all questions, players, teams, and other data into a single unified database.

## What This Does

Instead of loading one dataset at a time (which replaces the existing data), the **Bulk Import** feature:

1. ✅ Loads ALL 8 datasets from the catalog
2. ✅ Merges all questions from all books and versions
3. ✅ Merges all players from all datasets
4. ✅ Merges all team rosters
5. ✅ Merges all Bible verses, quiz sets, and other data
6. ✅ Creates one comprehensive database with everything

## How to Use

### From the Main Menu

1. Open the application
2. On the main menu, scroll down to the **Administration** section
3. Click **"Import All Datasets"**
4. Confirm the bulk import (it will warn you this may take a few minutes)
5. Watch the progress bar as it imports each dataset
6. When complete, you'll have ALL data loaded!

### What You'll Get

Based on the catalog, here's what will be imported:

| Dataset | Book | Version | Questions | Players | Teams |
|---------|------|---------|-----------|---------|-------|
| james98 | James | Default | 632 | 91 | 92 team memberships |
| niv-james98-niv1984 | James | NIV 1984 | 108 | 8 | team rosters |
| distfiles-james98 | James | Default | 936 | - | (questions only) |
| distfiles-james98-070498 | James | 070498 | 484 | 51 | team rosters |
| distfiles-james98-0906 | James | 0906 | 708 | - | (questions only) |
| backups-james98 | James | Default | 632 | 91 | team rosters |
| biblequizzing-2-10-titus99 | Titus | Default | ? | ? | ? |
| dist-b-files-titus99 | Titus | Default | ? | ? | ? |

**After bulk import, you'll have:**
- ✅ **2000+** questions across multiple books and versions
- ✅ **200+** unique players (duplicates merged)
- ✅ **200+** team membership records
- ✅ All quiz sets, verses, and reference data

## Technical Details

### New Method: `loadAllDatasets()`

Added to [direct-data-loader.service.ts](src/app/services/direct-data-loader.service.ts):

```typescript
async loadAllDatasets(
  progressCallback?: (message: string, current: number, total: number) => void
): Promise<void>
```

**Features:**
- Loads each dataset sequentially
- Merges data instead of replacing
- Provides progress updates via callback
- Continues even if one dataset fails
- Creates comprehensive UserFile with summary info

### UI Components

**Added to [main-menu.component.ts](src/app/components/main-menu/main-menu.component.ts):**
- `bulkImportAllDatasets()` method
- Progress tracking variables
- Confirmation dialog with dataset count

**Added to [main-menu.component.html](src/app/components/main-menu/main-menu.component.html):**
- "Import All Datasets" button in Administration section
- Progress indicator with visual progress bar
- Real-time status updates

**Added to [main-menu.component.css](src/app/components/main-menu/main-menu.component.css):**
- Progress bar styling
- Import status card design
- Animated progress fill

## How It Works

### Step 1: Clear Existing Data
```typescript
await this.dbService.clearAllData();
await this.dbService.init();
await this.dbService.initializeDefaultTypes();
```

### Step 2: Load Each Dataset
```typescript
for (const dataset of catalog) {
  const response = await fetch(dataset.path);
  const data = await response.json();

  // Set book and version for questions
  this.currentBook = dataset.book;
  this.currentVersion = dataset.version;

  // Process and merge data
  await this.processData(data, { questionsOnly: false });
}
```

### Step 3: Save Summary
```typescript
const userFile: UserFile = {
  book: 'All Books',
  quizDBname: 'Complete Database',
  quizIDPre: 'Quiz',
  quizIDNum: '1',
  backupDrive: 'A',
  bookVersion: 'Multiple Versions',
  datasetId: 'bulk-import'
};
```

## Data Merging Strategy

### Questions
- Each question gets `book` and `version` from its source dataset
- Question IDs remain unique
- Same question from different versions becomes separate records
- Use Question Version Analyzer to deduplicate if needed

### Players
- Player numbers are unique keys
- If same player exists in multiple datasets, last loaded wins
- Players from different datasets with different numbers are all kept

### Teams
- Team membership records are additive
- Each `{teamName, playerNumber}` pair is unique
- Multiple datasets can contribute to the same team roster

### Verses, Quiz Sets, Types
- Merged additively
- Duplicates are handled by IndexedDB (put operations)

## Progress Indicators

The bulk import shows real-time progress:

```
[1/8] James - Default
[2/8] James - NIV 1984
[3/8] James - 070498
...
[8/8] Titus - Default
```

## Console Output

Watch the browser console for detailed logs:

```
🌐 Starting bulk import of ALL datasets...
📚 Found 8 datasets to import

🔄 [1/8] James - Default
📥 Loading 632 questions directly...
   ✅ Saved 632 questions
📥 Loading 91 players directly...
   ✅ Saved 91 players
📥 Loading 92 teams directly...
   ✅ Saved 92 team roster records
✅ Imported James - Default

...

✨ BULK IMPORT COMPLETE ✨
📊 Total imported:
   • 2156 questions
   • 241 players
   • 284 teams
   • 8 datasets merged
```

## Files Modified

| File | Changes |
|------|---------|
| [direct-data-loader.service.ts](src/app/services/direct-data-loader.service.ts) | Added `loadAllDatasets()` method |
| [main-menu.component.ts](src/app/components/main-menu/main-menu.component.ts) | Added `bulkImportAllDatasets()`, progress tracking |
| [main-menu.component.html](src/app/components/main-menu/main-menu.component.html) | Added button and progress UI |
| [main-menu.component.css](src/app/components/main-menu/main-menu.component.css) | Added progress bar styles |

## Verification

After bulk import, use the Database Explorer to verify:

1. **Go to `/database-explorer`**
2. **Check record counts:**
   - Questions: Should show 2000+ records
   - Players: Should show 200+ records
   - Teams: Should show 200+ records
   - Verses: Should show all verses from loaded books
   - Quiz Sets: Should show all quiz sets combined

3. **Click into tables** to inspect data:
   - Questions should have different `book` and `version` values
   - Players should have merged data from all datasets
   - Teams should show combined rosters

## Differences from Single Dataset Loading

### Single Dataset (Original Behavior)
```typescript
await dataLoader.loadDatasetById('james-niv1984');
```
- ❌ Clears all existing data
- ❌ Loads only one dataset
- ❌ Replaces everything

### Bulk Import (New Feature)
```typescript
await dataLoader.loadAllDatasets();
```
- ✅ Clears data once, then merges
- ✅ Loads all datasets
- ✅ Creates comprehensive database

## When to Use Bulk Import

**Use Bulk Import When:**
- You want ALL data available at once
- You need to search across all books and versions
- You want a complete player/team roster from all sources
- You're setting up the application for the first time

**Use Single Dataset When:**
- You only quiz on one specific book/version
- You want to keep datasets separate
- You're testing a specific dataset
- You want to start fresh with just one book

## Future Enhancements

Possible improvements:
1. **Selective Import** - Choose which datasets to include
2. **Incremental Import** - Add datasets without clearing
3. **Conflict Resolution** - Choose how to handle duplicate players/teams
4. **Import Scheduling** - Auto-import on app startup
5. **Match History Import** - Include MatchSummary, MatchDetail, MatchStats
6. **Export Merged Database** - Save combined database as JSON

## Troubleshooting

### Issue: Import Fails Partway Through
**Solution:** Check browser console for specific dataset errors. The import will skip failed datasets and continue with others.

### Issue: Import Takes Too Long
**Solution:** The import processes 8 datasets sequentially. Large datasets with many players/questions will take longer. Expect 1-2 minutes total.

### Issue: Duplicate Players
**Solution:** If the same player exists in multiple datasets with different playerNumbers, they'll appear as separate players. Use database explorer to identify and merge manually if needed.

### Issue: Wrong Book/Version on Questions
**Solution:** Each question gets book/version from its source dataset. If a dataset has incorrect metadata in catalog.json, the questions will inherit that. Fix catalog.json and re-import.

## Summary

The Bulk Import feature gives you a **single button** to load everything from all datasets into one unified database. This is what you wanted - ALL the data for everything loaded and available!

Just click **"Import All Datasets"** from the main menu and wait a couple of minutes. Then use the Database Explorer to browse thousands of questions, hundreds of players, and all the other data merged together.
