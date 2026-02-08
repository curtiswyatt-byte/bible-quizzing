import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { Player, QuestionDetail, Verse, Team, UserFile, Parms, QuestionType } from '../models/player.model';
import { DataMigration } from '../utils/data-migration';
import { Subject } from 'rxjs';

export interface ImportProgress {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  currentItem: number;
  totalItems: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataImportService {
  private migration: DataMigration;
  private dbInitialized = false;
  private progressSubject = new Subject<ImportProgress>();
  public progress$ = this.progressSubject.asObservable();

  constructor(private dbService: DatabaseService) {
    this.migration = new DataMigration(this.dbService);
  }

  private async ensureDbInitialized(): Promise<void> {
    if (!this.dbInitialized) {
      try {
        // Wait a moment for app initialization if needed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Initialize database (idempotent - safe to call multiple times)
        await this.dbService.init();
        await this.dbService.initializeDefaultTypes();
        this.dbInitialized = true;
        console.log('Database initialized for import service');
      } catch (error) {
        console.error('Database initialization error:', error);
        // Try one more time after a delay
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await this.dbService.init();
          this.dbInitialized = true;
          console.log('Database initialized on retry');
        } catch (e) {
          console.error('Retry initialization failed:', e);
          throw new Error(`Database initialization failed: ${error}`);
        }
      }
    }
  }

  private async checkDbInitialized(): Promise<void> {
    if (!this.dbInitialized) {
      await this.ensureDbInitialized();
    }
  }

  /**
   * Import data from JSON file
   */
  async importFromJSON(file: File): Promise<void> {
    await this.checkDbInitialized();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          await this.importData(data);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Import data from CSV file
   */
  async importFromCSV(file: File, type: 'players' | 'questions' | 'verses'): Promise<void> {
    await this.checkDbInitialized();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvText = e.target?.result as string;
          const parsed = this.migration.parseCSV(csvText);
          
          if (type === 'players') {
            await this.migration.importPlayers(parsed);
          } else if (type === 'questions') {
            await this.migration.importQuestions(parsed);
          } else if (type === 'verses') {
            await this.migration.importVerses(parsed);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private updateProgress(step: number, totalSteps: number, stepName: string, current: number = 0, total: number = 0): void {
    const percentage = Math.round(((step - 1) / totalSteps) * 100 + (current / total) * (100 / totalSteps));
    this.progressSubject.next({
      currentStep: step,
      totalSteps,
      stepName,
      currentItem: current,
      totalItems: total,
      percentage: Math.min(percentage, 100)
    });
  }

  /**
   * Import complete data structure
   */
  async importData(data: any): Promise<void> {
    await this.checkDbInitialized();
    
    // Validate that database is initialized
    if (!this.dbService) {
      throw new Error('Database service not available');
    }
    
    // Calculate total items for progress tracking
    const totalItems = (data.players?.length || 0) + 
                       (data.questions?.length || 0) + 
                       (data.verses?.length || 0) + 
                       (data.teams?.reduce((sum: number, t: any) => sum + (t.playerNumbers?.length || 0), 0) || 0) +
                       (data.types?.length || 0) + 
                       (data.quizSets?.length || 0);
    
    let processedItems = 0;
    const totalSteps = 6;
    
    console.log('Importing data...', {
      players: data.players?.length || 0,
      questions: data.questions?.length || 0,
      verses: data.verses?.length || 0,
      teams: data.teams?.length || 0,
      quizSets: data.quizSets?.length || 0,
      totalItems
    });
    
    // Verify data structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format: expected an object');
    }
    
    try {
      // Step 1: Import players
      if (data.players && Array.isArray(data.players)) {
        this.updateProgress(1, totalSteps, 'Importing Players', 0, data.players.length);
        console.log(`[1/6] Importing ${data.players.length} players...`);
        await this.migration.importPlayers(data.players);
        
        // Verify players were actually saved
        const savedPlayers = await this.dbService.getAllPlayers();
        console.log(`Verification: ${savedPlayers.length} players now in database`);
        
        processedItems += data.players.length;
        this.updateProgress(1, totalSteps, 'Players Imported', data.players.length, data.players.length);
        console.log('✅ Players imported');
      } else {
        console.log('⚠️ No players data found in import file');
      }
      
      // Step 2: Import questions
      if (data.questions && Array.isArray(data.questions)) {
        this.updateProgress(2, totalSteps, 'Importing Questions', 0, data.questions.length);
        console.log(`[2/6] Importing ${data.questions.length} questions...`);
        await this.migration.importQuestions(data.questions);
        
        // Verify questions were actually saved
        const savedQuestions = await this.dbService.getAllQuestions();
        console.log(`Verification: ${savedQuestions.length} questions now in database`);
        
        processedItems += data.questions.length;
        this.updateProgress(2, totalSteps, 'Questions Imported', data.questions.length, data.questions.length);
        console.log('✅ Questions imported');
      } else {
        console.log('⚠️ No questions data found in import file');
      }
      
      // Step 3: Import verses
      if (data.verses && Array.isArray(data.verses)) {
        this.updateProgress(3, totalSteps, 'Importing Verses', 0, data.verses.length);
        console.log(`[3/6] Importing ${data.verses.length} verses...`);
        await this.migration.importVerses(data.verses);
        processedItems += data.verses.length;
        this.updateProgress(3, totalSteps, 'Verses Imported', data.verses.length, data.verses.length);
        console.log('✅ Verses imported');
      }
      
      // Step 4: Import teams
      if (data.teams && Array.isArray(data.teams)) {
        const totalTeamMembers = data.teams.reduce((sum: number, t: any) => sum + (t.playerNumbers?.length || 0), 0);
        let teamMembersProcessed = 0;
        this.updateProgress(4, totalSteps, 'Importing Teams', 0, totalTeamMembers);
        console.log(`[4/6] Importing ${data.teams.length} teams...`);
        let teamCount = 0;
        for (const team of data.teams) {
          if (team.teamName && team.playerNumbers && Array.isArray(team.playerNumbers)) {
            const teamName = team.teamName.trim();
            for (const playerNum of team.playerNumbers) {
              try {
                await this.dbService.addTeamMember(teamName, playerNum);
                teamMembersProcessed++;
                if (teamMembersProcessed % 10 === 0) {
                  this.updateProgress(4, totalSteps, 'Importing Teams', teamMembersProcessed, totalTeamMembers);
                }
              } catch (error) {
                // Team member might already exist, that's okay
                teamMembersProcessed++;
              }
            }
            teamCount++;
          }
        }
        this.updateProgress(4, totalSteps, 'Teams Imported', totalTeamMembers, totalTeamMembers);
        processedItems += totalTeamMembers;
        console.log(`✅ Teams imported: ${teamCount} teams`);
      }
      
      // Step 5: Import question types
      if (data.types && Array.isArray(data.types)) {
        this.updateProgress(5, totalSteps, 'Importing Question Types', 0, data.types.length);
        console.log(`[5/6] Importing ${data.types.length} question types...`);
        const types = data.types.map((t: any) => ({
          typeID: (t.typeID || t.TypeID || '').trim(),
          class: (t.class || t.Class || '').trim(),
          leadIn: (t.leadIn || t.LeadIn || '').trim()
        })).filter((t: { typeID: string }) => t.typeID);
        
        let typeProcessed = 0;
        for (const type of types) {
          try {
            await this.dbService.addType(type);
          } catch (error) {
            // Type might already exist, that's okay
            console.log(`Type ${type.typeID} may already exist, skipping...`);
          }
          typeProcessed++;
          this.updateProgress(5, totalSteps, 'Importing Question Types', typeProcessed, types.length);
        }
        processedItems += types.length;
        this.updateProgress(5, totalSteps, 'Question Types Imported', types.length, types.length);
        console.log(`✅ Question types imported`);
      }
      
      // Step 6: Import quiz sets (batch import for performance)
      if (data.quizSets && Array.isArray(data.quizSets)) {
        this.updateProgress(6, totalSteps, 'Importing Quiz Sets', 0, data.quizSets.length);
        console.log(`[6/6] Importing ${data.quizSets.length} quiz set items...`);
        const validQuizSets = data.quizSets
          .map((qs: any) => {
            const setID = (qs.setID || qs.SetID || '').trim();
            const questNum = parseInt(qs.questNum || qs.QuestNum || 0);
            const bonusNum = parseInt(qs.bonusNum || qs.BonusNum || 0);
            if (setID && questNum > 0) {
              return { setID, questNum, bonusNum };
            }
            return null;
          })
          .filter((qs: any): qs is { setID: string; questNum: number; bonusNum: number } => qs !== null);
        
        if (validQuizSets.length > 0) {
          await this.dbService.batchAddQuizSets(validQuizSets);
          processedItems += validQuizSets.length;
          this.updateProgress(6, totalSteps, 'Quiz Sets Imported', validQuizSets.length, validQuizSets.length);
          console.log(`✅ Successfully imported ${validQuizSets.length} quiz set items`);
        }
      }
      
      // Import user file and parameters
      if (data.userFile) {
        await this.migration.importUserFile(data.userFile);
        console.log('✅ User file imported');
      }
      
      if (data.parms) {
        await this.dbService.saveParms(data.parms);
        console.log('✅ Parameters imported');
      }
      
      // Skip question select records - not critical for basic functionality
      if (data.questionSelect && Array.isArray(data.questionSelect)) {
        console.log(`ℹ️  Skipping ${data.questionSelect.length} question select records (not critical for quiz operation)`);
      }
      
      // Final progress update
      this.updateProgress(totalSteps, totalSteps, 'Import Complete', totalItems, totalItems);
      console.log('✅ All data import completed!');
    } catch (error) {
      console.error('Error during import:', error);
      throw error;
    }
  }

  /**
   * Export all data to JSON
   */
  async exportToJSON(): Promise<string> {
    await this.checkDbInitialized();
    const players = await this.dbService.getAllPlayers();
    const questions = await this.dbService.getAllQuestions();
    const teams = await this.dbService.getAllTeams();
    const userFile = await this.dbService.getUserFile();
    
    const teamData = [];
    for (const teamName of teams) {
      const members = await this.dbService.getTeamMembers(teamName);
      teamData.push({ teamName, playerNumbers: members });
    }

    // Get verses (sample - would need to get all)
    // This is a simplified export

    const data = {
      players,
      questions,
      teams: teamData,
      userFile,
      exportDate: new Date().toISOString()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Create sample/default data for testing
   */
  async createSampleData(): Promise<void> {
    await this.checkDbInitialized();
    // Create default types
    const defaultTypes: QuestionType[] = [
      { typeID: 'IC', class: 'B', leadIn: 'an Incomplete Chapter' },
      { typeID: 'MC', class: 'B', leadIn: 'a Multiple Choice Chapter' },
      { typeID: 'FC', class: 'B', leadIn: 'a Fill-in-the-blank Chapter' },
      { typeID: 'IV', class: 'B', leadIn: 'an Incomplete Verse' },
      { typeID: 'MV', class: 'B', leadIn: 'a Multiple Choice Verse' },
      { typeID: 'Q', class: 'Q', leadIn: 'a Quote' }
    ];

    // Create default parameters
    const defaultParms: Parms = {
      book: 'James',
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

    try {
      await this.dbService.saveParms(defaultParms);
      // Types would need to be added through a separate method
      console.log('Sample data created');
    } catch (error) {
      console.error('Error creating sample data:', error);
    }
  }
}
