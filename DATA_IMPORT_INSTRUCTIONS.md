# Data Import Instructions

## Quick Start

The application now has a **Data Import** page accessible from the main menu. You can:

1. **Import from JSON** - Use a JSON file with all your data
2. **Import from CSV** - Import players, questions, or verses separately
3. **Export Data** - Export current data to JSON for backup
4. **Create Sample Data** - Generate default question types and parameters

## Converting .mdb Files to JSON

Since the browser cannot directly read Access .mdb files, you need to convert them first.

### Option 1: Using mdb-tools (Linux/Mac)

1. Install mdb-tools:
   ```bash
   brew install mdb-tools  # Mac
   # or
   sudo apt-get install mdbtools  # Linux
   ```

2. Run the conversion script:
   ```bash
   cd bible-quizzing-angular
   node scripts/convert-mdb-to-json.js /path/to/your/database.mdb
   ```

3. Import the generated JSON file using the Data Import page

### Option 2: Using Microsoft Access

1. Open your .mdb file in Microsoft Access
2. For each table:
   - Right-click the table
   - Select "Export" > "Text File"
   - Choose CSV format
   - Save the file
3. Use the CSV import feature in the application (one table at a time)

### Option 3: Using LibreOffice Base

1. Open LibreOffice Base
2. Connect to your .mdb file
3. Export each table to CSV
4. Use CSV import in the application

### Option 4: Manual Entry

Use the application's forms to enter data manually:
- Player Entry
- Question Entry
- Team Setup

## Expected Data Formats

### JSON Format

```json
{
  "players": [
    {
      "playerNumber": 1,
      "name": "John Doe",
      "nickname": "Johnny",
      "ageGroup": "Senior",
      "team": "Team A"
    }
  ],
  "questions": [
    {
      "questionID": 1,
      "qdescription": "What is the question?",
      "qAnswer": "The answer",
      "qChapter": 1,
      "qBegVerse": 1,
      "qEndVerse": 1,
      "qDescType": "IC"
    }
  ],
  "verses": [
    {
      "chapter": 1,
      "verse": 1,
      "text": "Verse text here"
    }
  ],
  "teams": [
    {
      "teamName": "Team A",
      "playerNumbers": [1, 2, 3, 4]
    }
  ]
}
```

### CSV Format

**Players CSV:**
```csv
Player Number,Name,Nickname,Age Group,Team
1,John Doe,Johnny,Senior,Team A
```

**Questions CSV:**
```csv
QuestionID,qdescription,QAnswer,QChapter,QBegVerse,QEndVerse,QDescType
1,What is the question?,The answer,1,1,1,IC
```

**Verses CSV:**
```csv
Chapter,Verse,Text
1,1,Verse text here
```

## Importing Steps

1. Navigate to Main Menu > File > Database Update
2. Choose your import type (JSON or CSV)
3. Select your file
4. Click "Import"
5. Wait for confirmation
6. Verify data in the appropriate sections

## Troubleshooting

### Import fails
- Check file format matches expected structure
- Verify column names match exactly
- Ensure numeric fields contain numbers only
- Check browser console for detailed errors

### Data not showing
- Refresh the page
- Check browser IndexedDB (DevTools > Application > IndexedDB)
- Try importing again

### Missing data
- Import in order: Players → Questions → Verses → Teams
- Ensure all required fields are present





