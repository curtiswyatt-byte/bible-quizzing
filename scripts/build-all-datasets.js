#!/usr/bin/env node
/**
 * One-shot MDB → JSON bundler.
 * Recursively finds every .mdb under the repo (except ignored folders),
 * runs `mdb-export` on key tables, writes each bundle to public/datasets/,
 * and regenerates public/datasets/catalog.json.
 *
 * Prerequisite: mdbtools (so `mdb-export` is available on PATH)
 *   • macOS:  brew install mdbtools
 *   • Ubuntu/Debian: sudo apt-get install mdbtools
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DATASET_DIR = path.resolve(__dirname, '..', 'public', 'datasets');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'public',
  'exported-data',
  'dist',
  'build'
]);

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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function titleCase(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_\-\s]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function deriveMetadata(relativePath) {
  const base = path.basename(relativePath, '.mdb');
  let book = base;
  let version = 'Default';

  if (base.includes('_')) {
    const [bookPart, versionPart] = base.split('_', 2);
    book = bookPart || book;
    version = versionPart || version;
  } else {
    const match = base.match(/(.*?)(NIV|NASB|ESV|NKJV|KJV)(.*)/i);
    if (match) {
      book = match[1]?.trim() || book;
      version = `${match[2]}${match[3] || ''}`.trim();
    }
  }

  book = titleCase(book.replace(/\d+$/g, '').trim() || base);
  version = titleCase(version || 'Default');

  const datasetId = relativePath
    .replace(/\.mdb$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');

  return {
    id: datasetId,
    book,
    version,
    description: `Converted from ${relativePath}`
  };
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(ROOT, fullPath);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      results.push(...scanDirectory(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mdb')) {
      results.push({ fullPath, relativePath: relative });
    }
  }
  return results;
}

function exportTable(mdbFile, tableName) {
  try {
    const tsv = execSync(`mdb-export -d "\t" "${mdbFile}" "${tableName}"`, { encoding: 'utf-8' });
    const lines = tsv.split('\n').filter(line => line.trim());
    if (!lines.length) return [];

    const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split('\t').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });
      return row;
    });
  } catch (err) {
    console.warn(`  Warning: failed to export ${tableName}: ${err.message}`);
    return [];
  }
}

function exportDataset(fileInfo) {
  const { fullPath, relativePath } = fileInfo;
  const meta = deriveMetadata(relativePath);

  console.log(`\n=== Exporting ${meta.book} (${meta.version}) ===`);
  console.log(`Source: ${relativePath}`);

  const output = {};
  for (const table of TABLES) {
    console.log(`  -> ${table}`);
    output[table] = exportTable(fullPath, table);
    console.log(`     ${output[table].length} records`);
  }

  output.userFile = {
    book: meta.book,
    quizDBname: `${meta.book} Dataset`,
    quizIDPre: 'Quiz',
    quizIDNum: '1',
    backupDrive: 'A',
    bookVersion: meta.version,
    datasetId: meta.id
  };

  const outPath = path.join(PUBLIC_DATASET_DIR, `${meta.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`  ✅ Wrote ${outPath}`);

  return meta;
}

function buildCatalog(datasetMetas) {
  const catalog = datasetMetas.map(meta => ({
    id: meta.id,
    book: meta.book,
    version: meta.version,
    path: `/datasets/${meta.id}.json`,
    description: meta.description,
    quizIdPrefix: 'Quiz',
    quizIdNumber: '1',
    backupDrive: 'A'
  }));

  const catalogPath = path.join(PUBLIC_DATASET_DIR, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`\n📚 Wrote catalog to ${catalogPath}`);
}

function main() {
  console.log('🔧 Scanning for MDB files...');
  ensureDir(PUBLIC_DATASET_DIR);

  const mdbFiles = scanDirectory(ROOT);
  if (!mdbFiles.length) {
    console.log('No MDB files found.');
    return;
  }

  console.log(`Found ${mdbFiles.length} MDB file(s).`);
  const metas = mdbFiles.map(exportDataset);
  buildCatalog(metas);

  console.log('\n✨ All datasets exported successfully!');
  console.log('Next: npm start → http://localhost:4200 → File → Data Library → activate dataset.');
}

main();
