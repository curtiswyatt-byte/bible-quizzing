import { Injectable } from '@angular/core';
import { Player, Team, QuestionDetail, QuestionSelect, QuizSet, Verse, QuestionType, Parms, MatchSummary, MatchDetail, MatchStats, UserFile } from '../models/player.model';
import { Tournament, TournamentStatus } from '../models/tournament.model';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private dbName = 'BibleQuizzingDB';
  private dbVersion = 5; // Bumped to add book/version indices to questionDetail
  private db: IDBDatabase | null = null;

  async getDatabase(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async init(): Promise<void> {
    // If already initialized, check if tournaments store exists
    if (this.db) {
      if (this.db.objectStoreNames.contains('tournaments')) {
        return Promise.resolve();
      }
      // Close and reopen to trigger upgrade
      this.db.close();
      this.db = null;
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;

        // Players table
        if (!db.objectStoreNames.contains('players')) {
          const playerStore = db.createObjectStore('players', { keyPath: 'playerNumber' });
          playerStore.createIndex('name', 'name', { unique: false });
          playerStore.createIndex('team', 'team', { unique: false });
        }

        // Teams table
        if (!db.objectStoreNames.contains('teams')) {
          const teamStore = db.createObjectStore('teams', { keyPath: ['teamName', 'playerNumber'] });
          teamStore.createIndex('teamName', 'teamName', { unique: false });
        }

        // QuestionDetail table
        if (!db.objectStoreNames.contains('questionDetail')) {
          const qdStore = db.createObjectStore('questionDetail', { keyPath: 'questionID' });
          qdStore.createIndex('qDescType', 'qDescType', { unique: false });
          qdStore.createIndex('book', 'book', { unique: false });
          qdStore.createIndex('version', 'version', { unique: false });
        } else {
          // Add indices if they don't exist (for upgrades)
          try {
            const qdStore = transaction.objectStore('questionDetail');
            if (!qdStore.indexNames.contains('book')) {
              qdStore.createIndex('book', 'book', { unique: false });
            }
            if (!qdStore.indexNames.contains('version')) {
              qdStore.createIndex('version', 'version', { unique: false });
            }
          } catch (e) {
            console.log('Note: Could not add indices to questionDetail store (may already exist)');
          }
        }

        // QuestionSelect table
        if (!db.objectStoreNames.contains('questionSelect')) {
          db.createObjectStore('questionSelect', { keyPath: 'selectionID' });
        }

        // QuizSet table
        if (!db.objectStoreNames.contains('quizSet')) {
          const quizSetStore = db.createObjectStore('quizSet', { keyPath: ['setID', 'questNum'] });
          quizSetStore.createIndex('setID', 'setID', { unique: false });
        } else {
          // Add index if it doesn't exist (for upgrades)
          try {
            const quizSetStore = transaction.objectStore('quizSet');
            if (!quizSetStore.indexNames.contains('setID')) {
              quizSetStore.createIndex('setID', 'setID', { unique: false });
            }
          } catch (e) {
            // Index might already exist or store might not be accessible
            console.log('Note: Could not add index to quizSet store (may already exist)');
          }
        }

        // Verses table
        if (!db.objectStoreNames.contains('verses')) {
          db.createObjectStore('verses', { keyPath: ['chapter', 'verse'] });
        }

        // Types table
        if (!db.objectStoreNames.contains('types')) {
          db.createObjectStore('types', { keyPath: 'typeID' });
        }

        // Parms table
        if (!db.objectStoreNames.contains('parms')) {
          db.createObjectStore('parms', { keyPath: 'book' });
        }

        // MatchSummary table
        if (!db.objectStoreNames.contains('matchSummary')) {
          db.createObjectStore('matchSummary', { keyPath: ['quizID', 'matchID'] });
        }

        // MatchDetail table
        if (!db.objectStoreNames.contains('matchDetail')) {
          db.createObjectStore('matchDetail', { keyPath: ['quizID', 'matchID', 'seqNum'] });
        }

        // MatchStats table
        if (!db.objectStoreNames.contains('matchStats')) {
          db.createObjectStore('matchStats', { keyPath: ['playerNumber', 'quizID', 'matchID'] });
        }

        // UserFile (single record)
        if (!db.objectStoreNames.contains('userFile')) {
          db.createObjectStore('userFile', { keyPath: 'id' });
        }

        // Tournaments table
        if (!db.objectStoreNames.contains('tournaments')) {
          const tournamentStore = db.createObjectStore('tournaments', { keyPath: 'tournamentID' });
          tournamentStore.createIndex('status', 'status', { unique: false });
          tournamentStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  // Initialize default types after database creation
  async initializeDefaultTypes(): Promise<void> {
    const existingTypes = await this.getAllTypes();
    if (existingTypes.length > 0) return; // Already initialized

    const defaultTypes: QuestionType[] = [
      { typeID: 'IC', class: 'B', leadIn: 'an Incomplete Chapter' },
      { typeID: 'MC', class: 'B', leadIn: 'a Multiple Choice Chapter' },
      { typeID: 'FC', class: 'B', leadIn: 'a Fill-in-the-blank Chapter' },
      { typeID: 'IV', class: 'B', leadIn: 'an Incomplete Verse' },
      { typeID: 'MV', class: 'B', leadIn: 'a Multiple Choice Verse' },
      { typeID: 'Q', class: 'Q', leadIn: 'a Quote' }
    ];

    for (const type of defaultTypes) {
      await this.addType(type);
    }
  }

  async addType(type: QuestionType): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['types'], 'readwrite');
      const request = tx.objectStore('types').put(type);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Player operations
  async addPlayer(player: Player): Promise<void> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['players'], 'readwrite');
      const request = tx.objectStore('players').put(player);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPlayer(playerNumber: number): Promise<Player | null> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['players'], 'readonly');
      const request = tx.objectStore('players').get(playerNumber);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllPlayers(): Promise<Player[]> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['players'], 'readonly');
      const request = tx.objectStore('players').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deletePlayer(playerNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['players'], 'readwrite');
      const request = tx.objectStore('players').delete(playerNumber);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Team operations
  async addTeamMember(teamName: string, playerNumber: number): Promise<void> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['teams'], 'readwrite');
      const request = tx.objectStore('teams').put({ teamName, playerNumber });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTeamMembers(teamName: string): Promise<number[]> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['teams'], 'readonly');
      const index = tx.objectStore('teams').index('teamName');
      const range = IDBKeyRange.only(teamName);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result.map((m: any) => m.playerNumber));
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllTeams(): Promise<string[]> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['teams'], 'readonly');
      const request = tx.objectStore('teams').getAll();
      request.onsuccess = () => {
        const teamNames = new Set<string>();
        request.result.forEach((t: any) => teamNames.add(t.teamName));
        resolve(Array.from(teamNames));
      };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async removeTeamMember(teamName: string, playerNumber: number): Promise<void> {
    await this.init(); // Ensure database is initialized
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['teams'], 'readwrite');
      const request = tx.objectStore('teams').delete([teamName, playerNumber]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameTeam(oldName: string, newName: string): Promise<void> {
    const members = await this.getTeamMembers(oldName);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['teams'], 'readwrite');
      const store = tx.objectStore('teams');
      let completed = 0;
      const total = members.length * 2;
      
      if (total === 0) {
        resolve();
        return;
      }

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };

      // Delete old entries
      members.forEach(member => {
        const delRequest = store.delete([oldName, member]);
        delRequest.onsuccess = checkComplete;
        delRequest.onerror = () => reject(delRequest.error);
      });

      // Add new entries
      members.forEach(member => {
        const addRequest = store.put({ teamName: newName, playerNumber: member });
        addRequest.onsuccess = checkComplete;
        addRequest.onerror = () => reject(addRequest.error);
      });

      tx.onerror = () => reject(tx.error);
    });
  }

  // Question operations
  async addQuestion(question: QuestionDetail): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionDetail'], 'readwrite');
      const request = tx.objectStore('questionDetail').put(question);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getQuestion(questionID: number): Promise<QuestionDetail | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionDetail'], 'readonly');
      const request = tx.objectStore('questionDetail').get(questionID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllQuestions(): Promise<QuestionDetail[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionDetail'], 'readonly');
      const request = tx.objectStore('questionDetail').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteQuestion(questionID: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionDetail', 'questionSelect'], 'readwrite');
      const del1 = tx.objectStore('questionDetail').delete(questionID);
      const del2 = tx.objectStore('questionSelect').delete(questionID);
      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) resolve();
      };
      del1.onsuccess = checkComplete;
      del2.onsuccess = checkComplete;
      del1.onerror = () => reject(del1.error);
      del2.onerror = () => reject(del2.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Verse operations
  async getVerse(chapter: number, verse: number): Promise<Verse | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['verses'], 'readonly');
      const request = tx.objectStore('verses').get([chapter, verse]);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getVerses(chapter: number, startVerse: number, endVerse: number): Promise<string> {
    const promises: Promise<Verse | null>[] = [];
    for (let v = startVerse; v <= endVerse; v++) {
      promises.push(this.getVerse(chapter, v));
    }
    const verses = await Promise.all(promises);
    const verseTexts = verses.filter(v => v !== null).map(v => v!.text);
    // Join with spaces for readability
    return verseTexts.join(' ');
  }

  async addVerse(verse: Verse): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['verses'], 'readwrite');
      const request = tx.objectStore('verses').put(verse);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // QuestionSelect operations
  async addQuestionSelect(qs: QuestionSelect): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionSelect'], 'readwrite');
      const request = tx.objectStore('questionSelect').put(qs);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getQuestionSelect(selectionID: number): Promise<QuestionSelect | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionSelect'], 'readonly');
      const request = tx.objectStore('questionSelect').get(selectionID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllQuestionSelect(): Promise<QuestionSelect[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionSelect'], 'readonly');
      const request = tx.objectStore('questionSelect').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // QuizSet operations
  async addQuizSetItem(setID: string, questNum: number, bonusNum: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['quizSet'], 'readwrite');
      const request = tx.objectStore('quizSet').put({ setID, questNum, bonusNum });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async batchAddQuizSets(quizSets: { setID: string; questNum: number; bonusNum: number }[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['quizSet'], 'readwrite');
      const store = tx.objectStore('quizSet');
      let completed = 0;
      const total = quizSets.length;

      if (total === 0) {
        resolve();
        return;
      }

      quizSets.forEach(qs => {
        const request = store.put({ setID: qs.setID, questNum: qs.questNum, bonusNum: qs.bonusNum });
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      tx.onerror = () => reject(tx.error);
    });
  }

  async getQuizSet(setID: string): Promise<QuizSet[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['quizSet'], 'readonly');
      const store = tx.objectStore('quizSet');
      
      // Try to use index if available, otherwise fall back to getAll
      try {
        if (store.indexNames.contains('setID')) {
          const index = store.index('setID');
          const range = IDBKeyRange.only(setID);
          const request = index.getAll(range);
          request.onsuccess = () => {
            const results = request.result.map((qs: any) => ({
              setID: qs.setID,
              questNum: qs.questNum,
              bonusNum: qs.bonusNum
            }));
            resolve(results);
          };
          request.onerror = () => reject(request.error);
        } else {
          // Fallback: get all and filter
          const request = store.getAll();
          request.onsuccess = () => {
            const results = request.result
              .filter((qs: any) => qs.setID === setID)
              .map((qs: any) => ({
                setID: qs.setID,
                questNum: qs.questNum,
                bonusNum: qs.bonusNum
              }));
            resolve(results);
          };
          request.onerror = () => reject(request.error);
        }
      } catch (error) {
        // Fallback: get all and filter
        const request = store.getAll();
        request.onsuccess = () => {
          const results = request.result
            .filter((qs: any) => qs.setID === setID)
            .map((qs: any) => ({
              setID: qs.setID,
              questNum: qs.questNum,
              bonusNum: qs.bonusNum
            }));
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      }
      
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllQuizSets(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['quizSet'], 'readonly');
      const request = tx.objectStore('quizSet').getAll();
      request.onsuccess = () => {
        const setIDs = new Set<string>();
        request.result.forEach((qs: any) => {
          if (qs.setID) {
            setIDs.add(qs.setID);
          }
        });
        resolve(Array.from(setIDs));
      };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getQuizSetItems(setID: string): Promise<QuizSet[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['quizSet'], 'readonly');
      const store = tx.objectStore('quizSet');
      const index = store.index('setID');
      const range = IDBKeyRange.only(setID);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Types operations
  async getAllTypes(): Promise<QuestionType[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['types'], 'readonly');
      const request = tx.objectStore('types').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Parms operations
  async getParms(book: string): Promise<Parms | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['parms'], 'readonly');
      const request = tx.objectStore('parms').get(book);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveParms(parms: Parms): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['parms'], 'readwrite');
      const request = tx.objectStore('parms').put(parms);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // MatchSummary operations
  async saveMatchSummary(summary: MatchSummary): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchSummary'], 'readwrite');
      const request = tx.objectStore('matchSummary').put(summary);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMatchSummary(quizID: string, matchID: string): Promise<MatchSummary | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchSummary'], 'readonly');
      const request = tx.objectStore('matchSummary').get([quizID, matchID]);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllMatchSummaries(): Promise<MatchSummary[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchSummary'], 'readonly');
      const request = tx.objectStore('matchSummary').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // MatchDetail operations
  async addMatchDetail(detail: MatchDetail): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchDetail'], 'readwrite');
      const request = tx.objectStore('matchDetail').put(detail);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMatchDetails(quizID: string, matchID: string): Promise<MatchDetail[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchDetail'], 'readonly');
      const request = tx.objectStore('matchDetail').getAll();
      request.onsuccess = () => resolve(request.result.filter((d: MatchDetail) => d.quizID === quizID && d.matchID === matchID));
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // MatchStats operations
  async saveMatchStats(stats: MatchStats): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchStats'], 'readwrite');
      const request = tx.objectStore('matchStats').put(stats);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMatchStats(playerNumber: number, quizID: string, matchID: string): Promise<MatchStats | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchStats'], 'readonly');
      const request = tx.objectStore('matchStats').get([playerNumber, quizID, matchID]);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllMatchStatsForTournament(quizID: string): Promise<MatchStats[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['matchStats'], 'readonly');
      const request = tx.objectStore('matchStats').getAll();
      request.onsuccess = () => resolve(request.result.filter((s: MatchStats) => s.quizID === quizID));
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // UserFile operations
  async getUserFile(): Promise<UserFile | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['userFile'], 'readonly');
      const request = tx.objectStore('userFile').get('current');
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { id, ...userFile } = result;
          resolve(userFile as UserFile);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveUserFile(userFile: UserFile): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['userFile'], 'readwrite');
      const request = tx.objectStore('userFile').put({ id: 'current', ...userFile });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllData(): Promise<void> {
    await this.init();
    const storeNames = [
      'players',
      'teams',
      'questionDetail',
      'questionSelect',
      'quizSet',
      'verses',
      'types',
      'parms',
      'matchSummary',
      'matchDetail',
      'matchStats',
      'userFile'
    ];

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeNames, 'readwrite');
        storeNames.forEach((name) => {
          const store = tx.objectStore(name);
          store.clear();
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Batch operations for data migration
  async batchAddPlayers(players: Player[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['players'], 'readwrite');
      const store = tx.objectStore('players');
      let completed = 0;
      let hasError = false;
      const total = players.length;

      if (total === 0) {
        resolve();
        return;
      }

      tx.oncomplete = () => {
        if (!hasError) {
          console.log(`✅ Transaction completed: ${completed}/${total} players saved`);
          resolve();
        }
      };

      tx.onerror = () => {
        hasError = true;
        console.error('Transaction error:', tx.error);
        reject(tx.error);
      };

      players.forEach((player, index) => {
        if (!player.playerNumber || isNaN(player.playerNumber)) {
          console.warn(`Skipping invalid player at index ${index}:`, player);
          completed++;
          if (completed === total && !hasError) {
            // Transaction will complete naturally
          }
          return;
        }

        const request = store.put(player);
        request.onsuccess = () => {
          completed++;
          if (completed === total && !hasError) {
            // Transaction will complete naturally via oncomplete
          }
        };
        request.onerror = () => {
          hasError = true;
          console.error(`Error saving player ${player.playerNumber}:`, request.error);
          reject(request.error);
        };
      });
    });
  }

  async batchAddVerses(verses: Verse[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['verses'], 'readwrite');
      const store = tx.objectStore('verses');
      let completed = 0;
      const total = verses.length;

      if (total === 0) {
        resolve();
        return;
      }

      verses.forEach(verse => {
        const request = store.put(verse);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      tx.onerror = () => reject(tx.error);
    });
  }

  async batchAddQuestions(questions: QuestionDetail[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['questionDetail'], 'readwrite');
      const store = tx.objectStore('questionDetail');
      let completed = 0;
      let hasError = false;
      const total = questions.length;

      if (total === 0) {
        resolve();
        return;
      }

      tx.oncomplete = () => {
        if (!hasError) {
          console.log(`✅ Transaction completed: ${completed}/${total} questions saved`);
          resolve();
        }
      };

      tx.onerror = () => {
        hasError = true;
        console.error('Transaction error:', tx.error);
        reject(tx.error);
      };

      questions.forEach((question, index) => {
        if (!question.questionID || isNaN(question.questionID) || question.questionID <= 0) {
          console.warn(`Skipping invalid question at index ${index}:`, question);
          completed++;
          if (completed === total && !hasError) {
            // Transaction will complete naturally
          }
          return;
        }

        const request = store.put(question);
        request.onsuccess = () => {
          completed++;
          if (completed === total && !hasError) {
            // Transaction will complete naturally via oncomplete
          }
        };
        request.onerror = () => {
          hasError = true;
          console.error(`Error saving question ${question.questionID}:`, request.error);
          reject(request.error);
        };
      });
    });
  }

  // Tournament operations
  async addTournament(tournament: Tournament): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tournaments'], 'readwrite');
      const request = tx.objectStore('tournaments').add(tournament);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTournament(tournamentID: string): Promise<Tournament | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tournaments'], 'readonly');
      const request = tx.objectStore('tournaments').get(tournamentID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTournament(tournament: Tournament): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tournaments'], 'readwrite');
      const request = tx.objectStore('tournaments').put(tournament);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteTournament(tournamentID: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tournaments'], 'readwrite');
      const request = tx.objectStore('tournaments').delete(tournamentID);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllTournaments(): Promise<Tournament[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tournaments'], 'readonly');
      const request = tx.objectStore('tournaments').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTournamentsByStatus(status: TournamentStatus): Promise<Tournament[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tournaments'], 'readonly');
      const index = tx.objectStore('tournaments').index('status');
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}
