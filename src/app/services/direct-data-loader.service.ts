import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { DatasetCatalogService } from './dataset-catalog.service';
import { QuizStateService } from './quiz-state.service';
import { DatasetInfo } from '../models/dataset-info.model';
import { QuestionDetail, Player, Verse, QuestionType, QuestionSelect, UserFile } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class DirectDataLoaderService {
  private dataLoaded = false;
  private activeDatasetId: string | null = null;
  private currentBook: string = '';
  private currentVersion: string = '';
  private readonly datasetStorageKey = 'activeDatasetId';

  constructor(
    private dbService: DatabaseService,
    private datasetCatalog: DatasetCatalogService,
    private quizState: QuizStateService
  ) {}

  async initialize(): Promise<void> {
    if (this.dataLoaded) {
      return;
    }

    // Initialize database but don't automatically load a dataset
    // This preserves manually entered players/teams across page refreshes
    await this.dbService.init();
    await this.dbService.initializeDefaultTypes();

    const catalog = await this.datasetCatalog.getCatalog();
    if (!catalog.length) {
      console.warn('Dataset catalog is empty. Please add datasets to /public/datasets/catalog.json.');
      return;
    }

    const persistedId = this.getPersistedDatasetId();
    if (persistedId) {
      this.activeDatasetId = persistedId;
      console.log(`📚 Active dataset: ${persistedId} (questions not reloaded on init)`);
    }

    this.dataLoaded = true;
  }

  getActiveDatasetId(): string | null {
    return this.activeDatasetId ?? this.getPersistedDatasetId();
  }

  async loadDatasetById(datasetId: string, options: { questionsOnly?: boolean } = {}): Promise<void> {
    const catalog = await this.datasetCatalog.getCatalog();
    const entry = catalog.find((item) => item.id === datasetId);
    if (!entry) {
      throw new Error(`Dataset with id "${datasetId}" not found in catalog.`);
    }
    await this.loadDataset(entry, {
      persistSelection: true,
      resetMatch: true,
      questionsOnly: options.questionsOnly === true // default to false (load all data), can be overridden
    });
  }

  async loadDataset(dataset: DatasetInfo, options: { persistSelection?: boolean; resetMatch?: boolean; questionsOnly?: boolean } = {}): Promise<void> {
    try {
      console.log(`🔄 Activating dataset: ${dataset.book} (${dataset.version})`);
      this.dataLoaded = false;

      // Store book and version for question processing
      this.currentBook = dataset.book;
      this.currentVersion = dataset.version;

      if (options.resetMatch !== false) {
        this.quizState.resetMatch();
      }

      // Only clear question-related data, preserve players/teams if questionsOnly is true
      if (options.questionsOnly) {
        console.log('📋 Loading questions only - preserving player and team data');
        await this.clearQuestionData();
      } else {
        await this.dbService.clearAllData();
      }

      const response = await fetch(dataset.path);
      if (!response.ok) {
        throw new Error(`Failed to load dataset from ${dataset.path}: ${response.statusText}`);
      }
      const data = await response.json();

      await this.processData(data, { questionsOnly: options.questionsOnly });
      await this.dbService.initializeDefaultTypes();

      const userFile: UserFile = {
        book: dataset.book,
        quizDBname: dataset.databaseName ?? `${dataset.book} Dataset`,
        quizIDPre: dataset.quizIdPrefix ?? 'Quiz',
        quizIDNum: dataset.quizIdNumber ?? '1',
        backupDrive: dataset.backupDrive ?? 'A',
        bookVersion: dataset.version,
        datasetId: dataset.id
      };
      await this.dbService.saveUserFile(userFile);

      this.activeDatasetId = dataset.id;
      if (options.persistSelection !== false) {
        this.persistActiveDatasetId(dataset.id);
      }

      this.dataLoaded = true;
      console.log(`✅ Dataset ready: ${dataset.book} (${dataset.version})`);
    } catch (error) {
      console.error('❌ Error activating dataset:', error);
      this.dataLoaded = false;
      throw error;
    }
  }

  /**
   * Allow tests/tools to load data without using fetch
   */
  async loadFromDataObject(
    data: any,
    options: { forceReload?: boolean; resetMatch?: boolean; dataset?: Partial<DatasetInfo> } = {}
  ): Promise<void> {
    if (this.dataLoaded && !options.forceReload) {
      console.log('Data already loaded, skipping... (loadFromDataObject)');
      return;
    }

    try {
      // Store book and version for question processing
      if (options.dataset) {
        this.currentBook = options.dataset.book ?? 'Unknown Book';
        this.currentVersion = options.dataset.version ?? '';
      }

      if (options.resetMatch !== false) {
        this.quizState.resetMatch();
      }
      await this.dbService.init();
      await this.processData(data);
      await this.dbService.initializeDefaultTypes();

      if (options.dataset) {
        const dataset = options.dataset;
        const userFile: UserFile = {
          book: dataset.book ?? 'Unknown Book',
          quizDBname: dataset.databaseName ?? `${dataset.book ?? 'Dataset'} Dataset`,
          quizIDPre: dataset.quizIdPrefix ?? 'Quiz',
          quizIDNum: dataset.quizIdNumber ?? '1',
          backupDrive: dataset.backupDrive ?? 'A',
          bookVersion: dataset.version ?? '',
          datasetId: dataset.id
        };
        await this.dbService.saveUserFile(userFile);
        if (dataset.id) {
          this.activeDatasetId = dataset.id;
          this.persistActiveDatasetId(dataset.id);
        }
      }

      this.dataLoaded = true;
    } catch (error) {
      console.error('❌ Error loading data from provided object:', error);
      throw error;
    }
  }

  private getPersistedDatasetId(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage.getItem(this.datasetStorageKey);
    } catch (error) {
      console.warn('Unable to read persisted dataset id:', error);
      return null;
    }
  }

  private persistActiveDatasetId(datasetId: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(this.datasetStorageKey, datasetId);
    } catch (error) {
      console.warn('Unable to persist active dataset id:', error);
    }
  }

  private async clearQuestionData(): Promise<void> {
    await this.dbService.init();
    const storeNames = [
      'questionDetail',
      'questionSelect',
      'quizSet',
      'verses',
      'types',
      'parms'
      // Don't clear match history stores - they have composite keys that can cause issues
      // 'matchSummary',
      // 'matchDetail',
      // 'matchStats'
    ];

    return new Promise((resolve, reject) => {
      try {
        const tx = (this.dbService as any).db!.transaction(storeNames, 'readwrite');

        let completed = 0;
        const total = storeNames.length;

        storeNames.forEach((name) => {
          const store = tx.objectStore(name);
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => {
            completed++;
            console.log(`  ✓ Cleared ${name} (${completed}/${total})`);
          };
          clearRequest.onerror = () => {
            console.error(`  ✗ Error clearing ${name}:`, clearRequest.error);
          };
        });

        tx.oncomplete = () => {
          console.log('✅ Question data cleared, players/teams preserved');
          resolve();
        };
        tx.onerror = () => {
          console.error('Transaction error in clearQuestionData:', tx.error);
          reject(tx.error);
        };
      } catch (error) {
        console.error('Exception in clearQuestionData:', error);
        reject(error);
      }
    });
  }

  private async processData(data: any, options: { questionsOnly?: boolean } = {}): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data payload for direct load');
    }

    // Load questions (handle both lowercase and uppercase)
    const questions = data.questions || data.QuestionDetail;
    if (questions && Array.isArray(questions) && questions.length > 0) {
      console.log(`📥 Loading ${questions.length} questions directly...`);
      await this.loadQuestionsDirect(questions);
    }

    // Load players (handle both lowercase and uppercase) - skip if questionsOnly
    if (!options.questionsOnly) {
      const players = data.players || data.Players;
      if (players && Array.isArray(players) && players.length > 0) {
        console.log(`📥 Loading ${players.length} players directly...`);
        await this.loadPlayersDirect(players);
      }
    } else {
      console.log('⏭️  Skipping players (questions-only mode)');
    }

    // Load question select mappings (needed for quiz sessions)
    const questionSelect = data.questionSelect || data.QuestionSelect;
    if (questionSelect && Array.isArray(questionSelect) && questionSelect.length > 0) {
      console.log(`📥 Loading ${questionSelect.length} question select records directly...`);
      await this.loadQuestionSelectDirect(questionSelect);
    }

    // Load verses (handle both lowercase and uppercase)
    const verses = data.verses || data.Verses;
    if (verses && Array.isArray(verses) && verses.length > 0) {
      console.log(`📥 Loading ${verses.length} verses directly...`);
      await this.loadVersesDirect(verses);
    }

    // Load teams (handle both lowercase and uppercase) - skip if questionsOnly
    if (!options.questionsOnly) {
      const teams = data.teams || data.Teams;
      if (teams && Array.isArray(teams) && teams.length > 0) {
        console.log(`📥 Loading ${teams.length} teams directly...`);
        await this.loadTeamsDirect(teams);
      }
    } else {
      console.log('⏭️  Skipping teams (questions-only mode)');
    }

    // Load types (handle both lowercase and uppercase)
    const types = data.types || data.Types;
    if (types && Array.isArray(types) && types.length > 0) {
      console.log(`📥 Loading ${types.length} question types directly...`);
      await this.loadTypesDirect(types);
    }

    // Load quiz sets (handle both lowercase and uppercase)
    const quizSets = data.quizSets || data.QuizSet;
    if (quizSets && Array.isArray(quizSets) && quizSets.length > 0) {
      console.log(`📥 Loading ${quizSets.length} quiz sets directly...`);
      await this.loadQuizSetsDirect(quizSets);
    }

    // Load user file (handle both lowercase and uppercase)
    const userFile = data.userFile || data.UserFile;
    if (userFile) {
      console.log('📥 Loading user file directly...');
      await this.dbService.saveUserFile(userFile);
    }

    // Load parameters (handle both lowercase and uppercase)
    const parms = data.parms || data.Parms;
    if (parms) {
      console.log('📥 Loading parameters directly...');
      // Handle both array and single object, and normalize property names
      const parmsArray = Array.isArray(parms) ? parms : [parms];
      for (const parm of parmsArray) {
        // Normalize the 'Book' property to lowercase 'book' for the keyPath
        const normalizedParm = {
          ...parm,
          book: parm.book || parm.Book
        };
        await this.dbService.saveParms(normalizedParm);
      }
    }

    // Verify what was loaded
    const savedQuestions = await this.dbService.getAllQuestions();
    const savedPlayers = await this.dbService.getAllPlayers();
    console.log(`✅ Verification: ${savedQuestions.length} questions, ${savedPlayers.length} players in database`);
    if (savedQuestions.length > 0) {
      console.log('   🔍 Sample question:', savedQuestions[0]);
    }
  }

  private async loadQuestionsDirect(questionsData: any[]): Promise<void> {
    const questions: QuestionDetail[] = questionsData
      .map(raw => {
        const questionID = parseInt(raw.questionID || raw.QuestionID || 0, 10);
        const qChapter = parseInt(raw.qChapter || raw.QChapter || 0, 10);
        const qBegVerse = parseInt(raw.qBegVerse || raw.QBegVerse || 0, 10);
        const qEndVerse = parseInt(raw.qEndVerse || raw.QEndVerse || 0, 10);

        if (!questionID || isNaN(questionID)) {
          return null;
        }

        return {
          questionID,
          qdescription: (raw.qdescription || raw.QDescription || '').trim() || ' ',
          qAnswer: (raw.qAnswer || raw.QAnswer || '').trim() || ' ',
          qChapter: isNaN(qChapter) ? 0 : qChapter,
          qBegVerse: isNaN(qBegVerse) ? 0 : qBegVerse,
          qEndVerse: isNaN(qEndVerse) ? 0 : qEndVerse,
          qDescType: (raw.qDescType || raw.QDescType || '').trim() || ' ',
          book: this.currentBook,
          version: this.currentVersion
        } as QuestionDetail;
      })
      .filter((q): q is QuestionDetail => !!q && q.questionID > 0);

    console.log(`   Filtered to ${questions.length} valid questions`);
    
    if (questions.length === 0) {
      console.warn('   No valid questions to load');
      return;
    }

    // Use individual puts to ensure they all save
    let saved = 0;
    let failed = 0;
    
    for (const question of questions) {
      try {
        await this.dbService.addQuestion(question);
        saved++;
        if (saved % 100 === 0) {
          console.log(`   Saved ${saved}/${questions.length} questions...`);
        }
      } catch (error) {
        failed++;
        console.error(`   Error saving question ${question.questionID}:`, error);
      }
    }

    console.log(`   ✅ Saved ${saved} questions, ${failed} failed`);
    
    // Verify
    const allQuestions = await this.dbService.getAllQuestions();
    console.log(`   ✅ Verification: ${allQuestions.length} questions now in database`);
    if (allQuestions.length > 0) {
      console.log('   🔍 Sample question:', allQuestions[0]);
    }
  }

  private async loadPlayersDirect(playersData: any[]): Promise<void> {
    const players: Player[] = playersData
      .map(raw => {
        const playerNumber = parseInt(raw.playerNumber || raw['Player Number'] || 0, 10);
        if (!playerNumber || isNaN(playerNumber)) {
          return null;
        }
        return {
          playerNumber,
          name: (raw.name || raw.Name || '').trim(),
          nickname: (raw.nickname || raw.Nickname || '').trim(),
          ageGroup: (raw.ageGroup || raw['Age Group'] || '').trim(),
          team: (raw.team || raw.Team || ' ').trim()
        } as Player;
      })
      .filter((p): p is Player => !!p && p.playerNumber > 0);

    if (players.length > 0) {
      await this.dbService.batchAddPlayers(players);
      console.log(`   ✅ Saved ${players.length} players`);
    }
  }

  private async loadQuestionSelectDirect(questionSelectData: any[]): Promise<void> {
    let saved = 0;
    let skipped = 0;

    for (const raw of questionSelectData) {
      const selectionID = parseInt(raw.selectionID || raw.SelectionID || 0, 10);
      if (!selectionID || isNaN(selectionID)) {
        skipped++;
        continue;
      }

      const qs: QuestionSelect = {
        selectionID,
        selectType: (raw.selectType || raw.SelectType || '').trim(),
        selChapter: parseInt(raw.selChapter || raw.SelChapter || 0, 10) || 0,
        selVerse: parseInt(raw.selVerse || raw.SelVerse || 0, 10) || 0,
        primUseCnt: parseInt(raw.primUseCnt || raw.PrimUseCnt || 0, 10) || 0,
        bonUseCnt: parseInt(raw.bonUseCnt || raw.BonUseCnt || 0, 10) || 0
      };

      try {
        await this.dbService.addQuestionSelect(qs);
        saved++;
      } catch (error) {
        console.warn(`   ⚠️ Unable to save question select for ${selectionID}:`, error);
      }
    }

    console.log(`   ✅ Saved ${saved} question select records, skipped ${skipped}`);
  }

  private async loadVersesDirect(versesData: any[]): Promise<void> {
    const verses: Verse[] = versesData
      .map(raw => {
        const chapter = parseInt(raw.chapter || raw.Chapter || 0, 10);
        const verse = parseInt(raw.verse || raw.Verse || 0, 10);
        if (!chapter || !verse || isNaN(chapter) || isNaN(verse)) {
          return null;
        }
        return {
          chapter,
          verse,
          text: (raw.text || raw.Text || '').trim()
        } as Verse;
      })
      .filter((v): v is Verse => !!v && v.chapter > 0 && v.verse > 0);

    if (verses.length > 0) {
      await this.dbService.batchAddVerses(verses);
      console.log(`   ✅ Saved ${verses.length} verses`);
    }
  }

  private async loadTeamsDirect(teamsData: any[]): Promise<void> {
    const aggregated = new Map<string, Set<number>>();

    for (const raw of teamsData) {
      const teamName = (raw.teamName || raw.TeamName || raw['Team Name'] || raw.team || '').trim();
      if (!teamName) {
        continue;
      }

      const set = aggregated.get(teamName) ?? new Set<number>();

      if (Array.isArray(raw.playerNumbers)) {
        for (const value of raw.playerNumbers) {
          const num = Number(value);
          if (!Number.isNaN(num) && num > 0) {
            set.add(num);
          }
        }
      }

      const singleNumber = raw.playerNumber || raw.PlayerNumber || raw['Player Number'];
      const parsed = Number(singleNumber);
      if (!Number.isNaN(parsed) && parsed > 0) {
        set.add(parsed);
      }

      aggregated.set(teamName, set);
    }

    for (const [teamName, playerSet] of aggregated.entries()) {
      for (const playerNumber of playerSet) {
        try {
          await this.dbService.addTeamMember(teamName, playerNumber);
        } catch {
          // ignore duplicates
        }
      }
    }

    console.log(`   ✅ Processed ${aggregated.size} teams`);
  }

  private async loadTypesDirect(typesData: any[]): Promise<void> {
    for (const type of typesData) {
      try {
        const typeID = (type.typeID || type.TypeID || type['Type ID'] || '').trim();
        const rawLeadIn = (type.leadIn || type.LeadIn || '').trim();
        const name = (type.Name || type.name || '').trim();
        const classField = (type.class || type.Class || '').trim();

        // Build a proper leadIn description
        // If leadIn is just "B" or empty, construct from Name and Class
        let leadIn = rawLeadIn;
        if (!leadIn || leadIn === 'B') {
          // Build description from Name and Class
          // e.g., Name="Finish the Verse", Class="Chapter Reference" -> "a Finish the Verse Chapter Reference question"
          if (name) {
            if (classField && classField !== 'B' && classField !== 'Q') {
              // Class contains reference type info (e.g., "Chapter Reference", "Verse Reference")
              leadIn = `a ${name} ${classField} question`;
            } else {
              leadIn = `a ${name} question`;
            }
          }
        }

        const typeObj: QuestionType = {
          typeID: typeID,
          class: (classField === 'B' || classField === 'Q') ? classField : 'B',
          leadIn: leadIn
        };
        if (typeObj.typeID) {
          await this.dbService.addType(typeObj);
        }
      } catch (error) {
        // Type might already exist
      }
    }
    console.log(`   ✅ Processed ${typesData.length} types`);
  }

  private async loadQuizSetsDirect(quizSetsData: any[]): Promise<void> {
    const validQuizSets = quizSetsData
      .map(qs => {
        const setID = (qs.setID || qs.SetID || '').trim();
        const questNum = parseInt(qs.questNum || qs.QuestNum || 0);
        const bonusNum = parseInt(qs.bonusNum || qs.BonusNum || 0);
        if (setID && questNum > 0) {
          return { setID, questNum, bonusNum };
        }
        return null;
      })
      .filter(qs => qs !== null) as { setID: string; questNum: number; bonusNum: number }[];

    if (validQuizSets.length > 0) {
      await this.dbService.batchAddQuizSets(validQuizSets);
      console.log(`   ✅ Saved ${validQuizSets.length} quiz sets`);
    }
  }

  /**
   * Load ALL datasets at once - merges data from all dataset files
   */
  async loadAllDatasets(progressCallback?: (message: string, current: number, total: number) => void): Promise<void> {
    try {
      console.log('🌐 Starting bulk import of ALL datasets...');

      // Clear all existing data first
      await this.dbService.clearAllData();
      await this.dbService.init();
      await this.dbService.initializeDefaultTypes();

      const catalog = await this.datasetCatalog.getCatalog();
      const totalDatasets = catalog.length;

      console.log(`📚 Found ${totalDatasets} datasets to import`);

      let currentDataset = 0;

      for (const dataset of catalog) {
        currentDataset++;
        const progress = `[${currentDataset}/${totalDatasets}] ${dataset.book} - ${dataset.version}`;
        console.log(`\n🔄 ${progress}`);

        if (progressCallback) {
          progressCallback(progress, currentDataset, totalDatasets);
        }

        try {
          // Fetch dataset
          const response = await fetch(dataset.path);
          if (!response.ok) {
            console.warn(`⚠️ Failed to load ${dataset.id}: ${response.statusText}`);
            continue;
          }

          const data = await response.json();

          // Store book and version for question processing
          this.currentBook = dataset.book;
          this.currentVersion = dataset.version;

          // Process data without clearing (merge mode)
          await this.processData(data, { questionsOnly: false });

          console.log(`✅ Imported ${dataset.book} - ${dataset.version}`);
        } catch (error) {
          console.error(`❌ Error importing ${dataset.id}:`, error);
          // Continue with next dataset even if one fails
        }
      }

      // Save user file with summary info
      const userFile: UserFile = {
        book: 'All Books',
        quizDBname: 'Complete Database',
        quizIDPre: 'Quiz',
        quizIDNum: '1',
        backupDrive: 'A',
        bookVersion: 'Multiple Versions',
        datasetId: 'bulk-import'
      };
      await this.dbService.saveUserFile(userFile);

      // Get final counts
      const allPlayers = await this.dbService.getAllPlayers();
      const allQuestions = await this.dbService.getAllQuestions();
      const allTeams = await this.dbService.getAllTeams();

      console.log('\n✨ BULK IMPORT COMPLETE ✨');
      console.log(`📊 Total imported:`);
      console.log(`   • ${allQuestions.length} questions`);
      console.log(`   • ${allPlayers.length} players`);
      console.log(`   • ${allTeams.length} teams`);
      console.log(`   • ${totalDatasets} datasets merged`);

      this.activeDatasetId = 'bulk-import';
      this.persistActiveDatasetId('bulk-import');
      this.dataLoaded = true;

      if (progressCallback) {
        progressCallback('Import complete!', totalDatasets, totalDatasets);
      }
    } catch (error) {
      console.error('❌ Bulk import failed:', error);
      throw error;
    }
  }
}

