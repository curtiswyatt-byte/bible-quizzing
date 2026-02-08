# Data Migration Guide

This guide helps you migrate data from the original VB6 Access database (.mdb) files to the new Angular application.

## Backup Your Data First!

**IMPORTANT**: Before starting any migration, ensure you have backups of all your .mdb files. Backups have been created in the `backups/` directory.

## Migration Options

### Option 1: Manual Entry (Recommended for Small Datasets)

1. Start the application
2. Navigate to each section (Players, Questions, Teams, etc.)
3. Enter data manually using the forms

### Option 2: CSV Export/Import

1. **Export from Access**:
   - Open your .mdb file in Microsoft Access
   - Export each table to CSV format
   - Save CSVs in a known location

2. **Use Migration Utility**:
   - The application includes a data migration utility
   - Import CSVs through the admin interface (to be implemented)

### Option 3: Database Tools

1. Use tools like:
   - MDB Explorer (Windows)
   - mdbtools (Linux/Mac)
   - LibreOffice Base
   
2. Export data to JSON or CSV format

3. Transform and import using the migration utility

## Database Tables to Migrate

### Required Tables:

1. **Players**
   - Player Number (Primary Key)
   - Name
   - Nickname
   - Age Group
   - Team

2. **Teams**
   - Team Name
   - Player Number (Composite Key)

3. **QuestionDetail**
   - QuestionID (Primary Key)
   - qdescription
   - QAnswer
   - QChapter
   - QBegVerse
   - QEndVerse
   - QDescType

4. **Verses**
   - Chapter (Primary Key part 1)
   - Verse (Primary Key part 2)
   - text

5. **QuestionSelect**
   - SelectionID (Primary Key)
   - SelectType
   - SelChapter
   - SelVerse
   - PrimUseCnt
   - BonUseCnt

6. **QuizSet**
   - SetID (Primary Key part 1)
   - QuestNum (Primary Key part 2)
   - BonusNum

7. **Types**
   - Type ID (Primary Key)
   - Class
   - LeadIn

8. **Parms**
   - Book (Primary Key)
   - All parameter fields

9. **MatchSummary** (if you have existing match data)
   - QuizID, MatchID (Composite Key)
   - Team1, Team2
   - Score1, Score2

10. **MatchDetail** (if you have existing match data)
    - QuizID, MatchID, SeqNum (Composite Key)
    - All detail fields

11. **MatchStats** (if you have existing match data)
    - PlayerNumber, QuizID, MatchID (Composite Key)
    - All stat fields

### Configuration:

12. **UserFile** (from quizuser.txt)
    - Book
    - QuizDBname
    - QuizIDPre
    - QuizIDNum
    - BackupDrive

## Verification Steps

After migration:

1. ✅ Verify all players are present
2. ✅ Verify all questions are present
3. ✅ Verify all teams are correctly set up
4. ✅ Verify verses are accessible
5. ✅ Test quiz session functionality
6. ✅ Verify statistics calculations

## Troubleshooting

### Data Not Appearing

- Check browser console for errors
- Verify IndexedDB is enabled in your browser
- Clear browser cache and try again
- Check that data format matches expected structure

### Import Errors

- Verify CSV format matches expected column names
- Check for special characters that might break parsing
- Ensure numeric fields are actually numbers
- Verify required fields are not empty

## Support

For issues during migration, refer to the original VB6 application code in the `QuizProgramCodeFiles` directory for reference on data structures and relationships.





