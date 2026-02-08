#!/usr/bin/env node

/**
 * MDB Data Importer for Bible Quizzing Angular App
 * 
 * This script converts Access .mdb files to JSON format for import
 * 
 * Prerequisites:
 * - Install mdbtools: brew install mdbtools (Mac) or apt-get install mdbtools (Linux)
 * - Or use Access to export to CSV
 * 
 * Usage:
 * node scripts/import-mdb-data.js <path-to-mdb-file>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mdbFile = process.argv[2];

if (!mdbFile) {
  console.error('Usage: node scripts/import-mdb-data.js <path-to-mdb-file>');
  process.exit(1);
}

if (!fs.existsSync(mdbFile)) {
  console.error(`Error: File not found: ${mdbFile}`);
  process.exit(1);
}

const outputDir = path.join(__dirname, '..', 'exported-data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🔄 Converting MDB to JSON...');
console.log(`📁 Input: ${mdbFile}`);
console.log(`📁 Output: ${outputDir}\n`);

const tables = [
  'Players',
  'Teams',
  'QuestionDetail',
  'QuestionSelect',
  'QuizSet',
  'Verses',
  'Types',
  'Parms'
];

const exportedData = {
  players: [],
  questions: [],
  verses: [],
  teams: [],
  types: [],
  parms: null,
  exportDate: new Date().toISOString()
};

function exportTable(tableName) {
  try {
    console.log(`  Exporting ${tableName}...`);
    const csv = execSync(`mdb-export "${mdbFile}" "${tableName}"`, { 
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 
    });
    
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      console.log(`    ⚠️  Table ${tableName} is empty`);
      return [];
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').replace(/\s+/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Handle CSV with quoted values that may contain commas
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';
        // Try to convert to number if it looks like one
        if (value && !isNaN(value) && value.trim() !== '') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            value = num;
          }
        }
        row[header] = value;
      });
      data.push(row);
    }
    
    console.log(`    ✅ Exported ${data.length} records`);
    return data;
  } catch (error) {
    console.log(`    ⚠️  Could not export ${tableName}: ${error.message}`);
    return [];
  }
}

// Export each table
tables.forEach(table => {
  const data = exportTable(table);
  
  switch (table) {
    case 'Players':
      exportedData.players = data.map(p => ({
        playerNumber: parseInt(p.PlayerNumber || p.playerNumber || 0),
        name: (p.Name || p.name || '').trim(),
        nickname: (p.Nickname || p.nickname || '').trim(),
        ageGroup: (p.AgeGroup || p.ageGroup || p['Age Group'] || '').trim(),
        team: (p.Team || p.team || ' ').trim()
      })).filter(p => p.playerNumber > 0);
      break;
      
    case 'QuestionDetail':
      exportedData.questions = data.map(q => ({
        questionID: parseInt(q.QuestionID || q.questionID || 0),
        qdescription: (q.QDescription || q.qdescription || q.qDescription || q.Description || '').trim(),
        qAnswer: (q.QAnswer || q.qAnswer || q.Answer || '').trim(),
        qChapter: parseInt(q.QChapter || q.qChapter || q.Chapter || 0),
        qBegVerse: parseInt(q.QBegVerse || q.qBegVerse || q.BegVerse || q['Beg Verse'] || 0),
        qEndVerse: parseInt(q.QEndVerse || q.qEndVerse || q.EndVerse || q['End Verse'] || 0),
        qDescType: (q.QDescType || q.qDescType || q.Type || '').trim()
      })).filter(q => q.questionID > 0);
      break;
      
    case 'QuestionSelect':
      exportedData.questionSelect = data.map(qs => ({
        selectionID: parseInt(qs.SelectionID || qs.selectionID || 0),
        selectType: (qs.SelectType || qs.selectType || '').trim(),
        selChapter: parseInt(qs.SelChapter || qs.selChapter || 0),
        selVerse: parseInt(qs.SelVerse || qs.selVerse || 0),
        primUseCnt: parseInt(qs.PrimUseCnt || qs.primUseCnt || 0),
        bonUseCnt: parseInt(qs.BonUseCnt || qs.bonUseCnt || 0)
      })).filter(qs => qs.selectionID > 0);
      break;
      
    case 'QuizSet':
      exportedData.quizSets = data.map(qs => ({
        setID: (qs.SetID || qs.setID || '').trim(),
        questNum: parseInt(qs.QuestNum || qs.questNum || 0),
        bonusNum: parseInt(qs.BonusNum || qs.bonusNum || 0)
      })).filter(qs => qs.setID && qs.questNum > 0);
      break;
      
    case 'Verses':
      exportedData.verses = data.map(v => ({
        chapter: parseInt(v.Chapter || v.chapter || 0),
        verse: parseInt(v.Verse || v.verse || 0),
        text: (v.Text || v.text || '').trim()
      })).filter(v => v.chapter > 0 && v.verse > 0);
      break;
      
    case 'Teams':
      // Group by team name
      const teamMap = new Map();
      data.forEach(t => {
        const teamName = (t.TeamName || t['Team Name'] || t.teamName || '').trim();
        const playerNum = parseInt(t.PlayerNumber || t.playerNumber || 0);
        if (teamName && playerNum > 0) {
          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, []);
          }
          teamMap.get(teamName).push(playerNum);
        }
      });
      exportedData.teams = Array.from(teamMap.entries()).map(([teamName, playerNumbers]) => ({
        teamName,
        playerNumbers
      }));
      break;
      
    case 'Types':
      exportedData.types = data.map(t => ({
        typeID: (t.TypeID || t.typeID || '').trim(),
        class: (t.Class || t.class || '').trim(),
        leadIn: (t.LeadIn || t.leadIn || '').trim()
      })).filter(t => t.typeID);
      break;
      
    case 'Parms':
      if (data.length > 0) {
        exportedData.parms = {
          book: (data[0].Book || data[0].book || '').trim(),
          quizOutNum: parseInt(data[0].QuizOutNum || data[0].quizOutNum || 4),
          errOutNum: parseInt(data[0].ErrOutNum || data[0].errOutNum || 3),
          foulOutNum: parseInt(data[0].FoulOutNum || data[0].foulOutNum || 3),
          timeouts: parseInt(data[0].Timeouts || data[0].timeouts || 2),
          matchLength: parseInt(data[0].MatchLength || data[0].matchLength || 20),
          quizOutPoints: parseInt(data[0].QuizOutPoints || data[0].quizOutPoints || 10),
          errOutPoints: parseInt(data[0].ErrOutPoints || data[0].errOutPoints || 10),
          foulOutPoints: parseInt(data[0].FoulOutPoints || data[0].foulOutPoints || 10),
          penaltyNum: parseInt(data[0].PenaltyNum || data[0].penaltyNum || 17),
          corrPoints: parseInt(data[0].CorrPoints || data[0].corrPoints || 20),
          bonusPoints: parseInt(data[0].BonusPoints || data[0].bonusPoints || 10),
          tieBreaker: parseInt(data[0].TieBreaker || data[0].tieBreaker || 3)
        };
      }
      break;
  }
});

// Save to JSON
const outputFile = path.join(outputDir, 'import-data.json');
fs.writeFileSync(outputFile, JSON.stringify(exportedData, null, 2));

console.log('\n✅ Conversion complete!');
console.log(`📄 Output file: ${outputFile}`);
console.log(`\n📊 Summary:`);
console.log(`   Players: ${exportedData.players.length}`);
console.log(`   Questions: ${exportedData.questions.length}`);
console.log(`   Verses: ${exportedData.verses.length}`);
console.log(`   Teams: ${exportedData.teams.length}`);
console.log(`   Types: ${exportedData.types.length}`);
console.log(`\n💡 Next steps:`);
console.log(`   1. Open the application`);
console.log(`   2. Go to Main Menu > File > Database Update`);
console.log(`   3. Select the JSON file: ${outputFile}`);
console.log(`   4. Click Import`);

