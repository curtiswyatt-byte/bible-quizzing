/**
 * Data Migration Utility
 * 
 * This utility helps migrate data from the old Access .mdb files to IndexedDB.
 * Note: Reading .mdb files directly requires additional tools/libraries.
 * 
 * For now, this provides a structure for manual data entry or CSV import.
 */

import { DatabaseService } from '../services/database.service';
import { Player, QuestionDetail, Verse, UserFile, Parms } from '../models/player.model';

export class DataMigration {
  constructor(private dbService: DatabaseService) {}

  /**
   * Import players from CSV-like data structure
   */
  async importPlayers(playersData: any[]): Promise<void> {
    if (!playersData || !Array.isArray(playersData) || playersData.length === 0) {
      console.warn('No players data to import');
      return;
    }

    console.log(`Processing ${playersData.length} player records...`);
    
    const players: Player[] = playersData
      .map(p => {
        const playerNumber = parseInt(p.playerNumber) || parseInt(p['Player Number']) || 0;
        if (!playerNumber || isNaN(playerNumber)) {
          console.warn('Skipping player with invalid playerNumber:', p);
          return null;
        }
        return {
          playerNumber: playerNumber,
          name: (p.name || p.Name || '').trim(),
          nickname: (p.nickname || p.Nickname || '').trim(),
          ageGroup: (p.ageGroup || p['Age Group'] || '').trim(),
          team: (p.team || p.Team || ' ').trim()
        };
      })
      .filter((p): p is Player => p !== null);

    console.log(`Filtered to ${players.length} valid players`);
    
    if (players.length === 0) {
      console.warn('No valid players to import after filtering');
      return;
    }

    try {
      await this.dbService.batchAddPlayers(players);
      console.log(`✅ Successfully imported ${players.length} players`);
    } catch (error) {
      console.error('Error importing players:', error);
      throw error;
    }
  }

  /**
   * Import questions from CSV-like data structure
   */
  async importQuestions(questionsData: any[]): Promise<void> {
    if (!questionsData || !Array.isArray(questionsData) || questionsData.length === 0) {
      console.warn('No questions data to import');
      return;
    }

    console.log(`Processing ${questionsData.length} question records...`);
    
    const questions: QuestionDetail[] = questionsData
      .map((q, index) => {
        const questionID = parseInt(q.questionID || q.QuestionID || 0);
        if (!questionID || isNaN(questionID) || questionID <= 0) {
          console.warn(`Skipping question at index ${index} with invalid questionID:`, q);
          return null;
        }
        
        const qdescription = (q.qdescription || q.QDescription || q.qDescription || q.Description || q.description || '').trim();
        if (!qdescription) {
          console.warn(`Skipping question ${questionID} with empty description`);
          return null;
        }
        
        return {
          questionID: questionID,
          qdescription: qdescription,
          qAnswer: (q.qAnswer || q.QAnswer || q.answer || q.Answer || '').trim() || ' ',
          qChapter: parseInt(q.qChapter || q.QChapter || q.chapter || q.Chapter || 0),
          qBegVerse: parseInt(q.qBegVerse || q.QBegVerse || q.begVerse || q.BegVerse || q['Beg Verse'] || 0),
          qEndVerse: parseInt(q.qEndVerse || q.QEndVerse || q.endVerse || q.EndVerse || q['End Verse'] || 0),
          qDescType: (q.qDescType || q.QDescType || q.type || q.Type || '').trim() || ' '
        };
      })
      .filter((q): q is QuestionDetail => q !== null);

    console.log(`Filtered to ${questions.length} valid questions`);
    
    if (questions.length === 0) {
      console.warn('No valid questions to import after filtering');
      return;
    }

    try {
      await this.dbService.batchAddQuestions(questions);
      console.log(`✅ Successfully imported ${questions.length} questions`);
    } catch (error) {
      console.error('Error importing questions:', error);
      throw error;
    }
  }

  /**
   * Import verses from CSV-like data structure
   */
  async importVerses(versesData: any[]): Promise<void> {
    if (!versesData || !Array.isArray(versesData) || versesData.length === 0) {
      console.warn('No verses data to import');
      return;
    }

    console.log(`Processing ${versesData.length} verse records...`);
    
    const verses: Verse[] = versesData
      .map(v => {
        const chapter = parseInt(v.chapter) || parseInt(v.Chapter) || 0;
        const verse = parseInt(v.verse) || parseInt(v.Verse) || 0;
        if (!chapter || !verse || isNaN(chapter) || isNaN(verse)) {
          console.warn('Skipping verse with invalid chapter/verse:', v);
          return null;
        }
        return {
          chapter: chapter,
          verse: verse,
          text: (v.text || v.Text || '').trim()
        };
      })
      .filter((v): v is Verse => v !== null);

    console.log(`Filtered to ${verses.length} valid verses`);
    
    if (verses.length === 0) {
      console.warn('No valid verses to import after filtering');
      return;
    }

    try {
      await this.dbService.batchAddVerses(verses);
      console.log(`✅ Successfully imported ${verses.length} verses`);
    } catch (error) {
      console.error('Error importing verses:', error);
      throw error;
    }
  }

  /**
   * Import user file configuration
   */
  async importUserFile(userFileData: any): Promise<void> {
    const userFile: UserFile = {
      book: userFileData.book || userFileData.Book || '',
      quizDBname: userFileData.quizDBname || userFileData.QuizDBname || '',
      quizIDPre: userFileData.quizIDPre || userFileData.QuizIDPre || '',
      quizIDNum: userFileData.quizIDNum || userFileData.QuizIDNum || '',
      backupDrive: userFileData.backupDrive || userFileData.BackupDrive || 'A'
    };

    await this.dbService.saveUserFile(userFile);
  }

  /**
   * Import default parameters
   */
  async importDefaultParms(book: string): Promise<void> {
    const defaultParms: Parms = {
      book: book,
      quizOutNum: 4,
      errOutNum: 3,
      foulOutNum: 3,
      timeouts: 2,
      matchLength: 20,
      quizOutPoints: 10,
      errOutPoints: 10,
      foulOutPoints: 10,
      penaltyNum: 17,
      corrPoints: 20,
      bonusPoints: 10,
      tieBreaker: 3
    };

    await this.dbService.saveParms(defaultParms);
  }

  /**
   * Helper to parse CSV text
   */
  parseCSV(csvText: string): any[] {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  }
}

