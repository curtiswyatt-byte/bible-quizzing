#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATASETS = [
  {
    id: 'james-niv1984',
    book: 'James',
    version: 'NIV 1984',
    mdbPath: path.resolve(__dirname, '..', '..', 'James98.mdb'),
    quizIdPrefix: 'Quiz',
    quizIdNumber: '1',
    backupDrive: 'A',
    description: 'Converted from James98.mdb'
  },
  {
    id: 'titus-niv1984',
    book: 'Titus',
    version: 'NIV 1984',
    mdbPath: path.resolve(__dirname, '..', '..', 'BibleQuizzing 2.10', 'Titus99.mdb'),
    quizIdPrefix: 'Quiz',
    quizIdNumber: '2',
    backupDrive: 'B',
    description: 'Converted from Titus99.mdb'
  }
];

const TABLES = [
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

const PUBLIC_DATASET_DIR = path.resolve(__dirname, '..', 'public', 'datasets');

if (!fs.existsSync(PUBLIC_DATASET_DIR)) {
  fs.mkdirSync(PUBLIC_DATASET_DIR, { recursive: true });
}

function exportTable(mdbFile, tableName) {
  try {
    const csv = execSync(`mdb-export "${mdbFile}" "${tableName}"`, { encoding: 'utf-8' });
    const lines = csv.split('\n').filter(line => line.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, idx) => { row[header] = values[idx] ?? ''; });
      return row;
    });
  } catch (err) {
    console.warn(`  Warning: failed to export ${tableName}: ${err.message}`);
    return [];
  }
}

function exportDataset(dataset) {
  console.log(`\n=== Exporting ${dataset.book} (${dataset.version}) ===`);
  if (!fs.existsSync(dataset.mdbPath)) {
    throw new Error(`MDB not found: ${dataset.mdbPath}`);
  }

  const output = {};
  for (const table of TABLES) {
    console.log(`  -> ${table}`);
    output[table] = exportTable(dataset.mdbPath, table);
    console.log(`     ${output[table].length} records`);
  }

  output.userFile = {
    book: dataset.book,
    quizDBname: dataset.databaseName ?? `${dataset.book} Dataset`,
    quizIDPre: dataset.quizIdPrefix ?? 'Quiz',
    quizIDNum: dataset.quizIdNumber ?? '1',
    backupDrive: dataset.backupDrive ?? 'A',
    bookVersion: dataset.version,
    datasetId: dataset.id
  };

  const outPath = path.join(PUBLIC_DATASET_DIR, `${dataset.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`  ✅ Wrote ${outPath}`);
}

function rebuildCatalog(datasets) {
  const catalog = datasets.map(ds => ({
    id: ds.id,
    book: ds.book,
    version: ds.version,
    path: `/datasets/${ds.id}.json`,
    description: ds.description ?? '',
    quizIdPrefix: ds.quizIdPrefix ?? 'Quiz',
    quizIdNumber: ds.quizIdNumber ?? '1',
    backupDrive: ds.backupDrive ?? 'A'
  }));

  const catalogPath = path.join(PUBLIC_DATASET_DIR, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`\n📚 Wrote dataset catalog to ${catalogPath}`);
}

function main() {
  console.log('🔧 Building Angular datasets from MDB files\n');
  DATASETS.forEach(exportDataset);
  rebuildCatalog(DATASETS);
  console.log('\n✨ All datasets exported successfully!\n');
  console.log('Next step: run `npm start` and open http://localhost:4200');
  console.log('Use File → Data Library to activate a dataset.');
}

main();
