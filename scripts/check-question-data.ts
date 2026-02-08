import 'fake-indexeddb/auto';
import path from 'path';
import { readFileSync } from 'fs';

import { DatabaseService } from '../src/app/services/database.service';
import { DirectDataLoaderService } from '../src/app/services/direct-data-loader.service';
import { QuizStateService } from '../src/app/services/quiz-state.service';
import { DatasetCatalogService } from '../src/app/services/dataset-catalog.service';
import { DatasetInfo } from '../src/app/models/dataset-info.model';

async function main() {
  const dataPath = path.resolve(__dirname, '..', 'exported-data', 'import-data.json');
  const rawJson = readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(rawJson);

  const dbService = new DatabaseService();
  const datasetStub = { getCatalog: async () => [] } as DatasetCatalogService;
  const quizState = new QuizStateService();
  const loader = new DirectDataLoaderService(dbService, datasetStub, quizState);

  const datasetInfo: Partial<DatasetInfo> = {
    id: 'script-check',
    book: data.userFile?.book || 'Unknown',
    version: data.userFile?.bookVersion || 'Unknown'
  };

  await loader.loadFromDataObject(data, { forceReload: true, dataset: datasetInfo, resetMatch: true });

  const questions = await dbService.getAllQuestions();
  console.log(`✅ Stored questions count: ${questions.length}`);

  if (questions.length > 0) {
    const sample = questions
      .slice(0, 5)
      .map(q => ({
        id: q.questionID,
        description: q.qdescription,
        chapter: q.qChapter,
        verses: `${q.qBegVerse}-${q.qEndVerse}`,
        type: q.qDescType
      }));

    console.log('🔍 Sample questions:', JSON.stringify(sample, null, 2));
  }
}

main().catch(err => {
  console.error('❌ Failed to verify question data:', err);
  process.exitCode = 1;
});
