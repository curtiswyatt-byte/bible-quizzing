#!/usr/bin/env node

/**
 * MDB to JSON Converter
 * 
 * This script helps convert Access .mdb files to JSON format for import.
 * 
 * Prerequisites:
 * - Install mdb-tools (Linux/Mac): brew install mdb-tools
 * - Or use a Node.js library like node-mdb
 * 
 * Usage:
 * node convert-mdb-to-json.js <path-to-mdb-file> [output-directory]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mdbFile = process.argv[2];
const outputDir = process.argv[3] || './exported-data';

if (!mdbFile) {
  console.error('Usage: node convert-mdb-to-json.js <path-to-mdb-file> [output-directory]');
  process.exit(1);
}

if (!fs.existsSync(mdbFile)) {
  console.error(`Error: File not found: ${mdbFile}`);
  process.exit(1);
}

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Converting MDB to JSON...');
console.log(`Input: ${mdbFile}`);
console.log(`Output: ${outputDir}`);

// Table names to export
const tables = [
  'Players',
  'Teams',
  'QuestionDetail',
  'QuestionSelect',
  'QuizSet',
  'Verses',
  'Types',
  'Parms',
  'MatchSummary',
  'MatchDetail',
  'MatchStats'
];

const exportedData = {};

// Try using mdb-tools if available
try {
  tables.forEach(table => {
    try {
      console.log(`Exporting table: ${table}`);
      
      // Use mdb-export to export to CSV, then parse
      const csv = execSync(`mdb-export "${mdbFile}" "${table}"`, { encoding: 'utf-8' });
      
      // Parse CSV
      const lines = csv.split('\n').filter(l => l.trim());
      if (lines.length === 0) {
        console.log(`  Table ${table} is empty`);
        exportedData[table] = [];
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
      
      exportedData[table] = data;
      console.log(`  Exported ${data.length} records from ${table}`);
    } catch (error) {
      console.log(`  Warning: Could not export ${table}: ${error.message}`);
      exportedData[table] = [];
    }
  });
  
  // Save to JSON
  const jsonOutput = JSON.stringify(exportedData, null, 2);
  const outputFile = path.join(outputDir, 'exported-data.json');
  fs.writeFileSync(outputFile, jsonOutput);
  
  console.log(`\nConversion complete!`);
  console.log(`Output file: ${outputFile}`);
  console.log(`\nYou can now import this file using the Data Import page in the application.`);
  
} catch (error) {
  console.error('Error:', error.message);
  console.log('\nAlternative: Use a tool like:');
  console.log('  - MDB Explorer (Windows)');
  console.log('  - LibreOffice Base');
  console.log('  - Access (export to CSV)');
  console.log('\nThen use the CSV import feature in the application.');
  process.exit(1);
}





