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
  const questionMap = new Map(questions.map(q => [q.questionID, q]));

  const questionSelect = await dbService.getAllQuestionSelect();
  const questionSelectMap = new Map(questionSelect.map(qs => [qs.selectionID, qs]));

  const setIDs = await dbService.getAllQuizSets();
  console.log(`🔍 Found ${setIDs.length} quiz sets`);

  let totalEntries = 0;
  const missingQuestion: Array<{ setID: string; questNum: number }> = [];
  const missingQuestionSelect: Array<{ setID: string; questNum: number }> = [];

  for (const setID of setIDs) {
    const items = await dbService.getQuizSetItems(setID);
    totalEntries += items.length;

    for (const item of items) {
      const questID = item.questNum;

      if (!questionMap.has(questID)) {
        missingQuestion.push({ setID, questNum: questID });
      }

      if (!questionSelectMap.has(questID)) {
        missingQuestionSelect.push({ setID, questNum: questID });
      }
    }
  }

  console.log(`✅ Quiz set entries checked: ${totalEntries}`);

  if (missingQuestion.length === 0 && missingQuestionSelect.length === 0) {
    console.log('✅ All quiz set entries reference existing questions and question select records.');
  } else {
    if (missingQuestion.length > 0) {
      console.warn(`⚠️ ${missingQuestion.length} quiz set entries reference missing questions:`);
      console.warn(JSON.stringify(missingQuestion.slice(0, 10), null, 2));
    }
    if (missingQuestionSelect.length > 0) {
      console.warn(`⚠️ ${missingQuestionSelect.length} quiz set entries reference missing question select records:`);
      console.warn(JSON.stringify(missingQuestionSelect.slice(0, 10), null, 2));
    }
  }
}

main().catch(err => {
  console.error('❌ Failed to verify quiz set relationships:', err);
  process.exitCode = 1;
});
