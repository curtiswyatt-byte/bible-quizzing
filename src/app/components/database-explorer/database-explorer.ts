import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';

interface TableInfo {
  name: string;
  displayName: string;
  icon: string;
  recordCount: number;
  keyPath: string;
  indices: string[];
  description: string;
  relatedTables: string[];
}

interface TableData {
  tableName: string;
  records: any[];
  columns: string[];
}

@Component({
  selector: 'app-database-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './database-explorer.html',
  styleUrl: './database-explorer.css'
})
export class DatabaseExplorerComponent implements OnInit {
  tables: TableInfo[] = [];
  selectedTable: TableInfo | null = null;
  tableData: TableData | null = null;
  isLoading = false;
  searchTerm = '';
  viewMode: 'diagram' | 'table' = 'diagram';

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  get totalRecords(): number {
    return this.tables.reduce((sum, t) => sum + t.recordCount, 0);
  }

  get totalIndices(): number {
    return this.tables.reduce((sum, t) => sum + t.indices.length, 0);
  }

  async ngOnInit() {
    await this.loadTableInfo();
  }

  async loadTableInfo() {
    this.isLoading = true;

    try {
      // Define table metadata - must match database.service.ts schema exactly
      this.tables = [
        {
          name: 'userFile',
          displayName: 'User Configuration',
          icon: '📚',
          recordCount: 0,
          keyPath: 'id',
          indices: [],
          description: 'User file and dataset configuration (single record)',
          relatedTables: ['questionDetail']
        },
        {
          name: 'questionDetail',
          displayName: 'Questions',
          icon: '❓',
          recordCount: 0,
          keyPath: 'questionID',
          indices: ['qDescType', 'book', 'version'],
          description: 'Quiz questions with chapter and verse references',
          relatedTables: ['userFile', 'quizSet']
        },
        {
          name: 'players',
          displayName: 'Players',
          icon: '👤',
          recordCount: 0,
          keyPath: 'playerNumber',
          indices: ['name', 'team'],
          description: 'Player information and team assignments',
          relatedTables: ['teams', 'matchStats']
        },
        {
          name: 'teams',
          displayName: 'Team Rosters',
          icon: '👥',
          recordCount: 0,
          keyPath: 'teamName,playerNumber',
          indices: ['teamName'],
          description: 'Team member relationships (one record per player-team pair)',
          relatedTables: ['players', 'matchSummary']
        },
        {
          name: 'quizSet',
          displayName: 'Quiz Sets',
          icon: '📋',
          recordCount: 0,
          keyPath: 'setID,questNum',
          indices: ['setID'],
          description: 'Question assignments to quiz sets',
          relatedTables: ['questionDetail']
        },
        {
          name: 'matchSummary',
          displayName: 'Match Summaries',
          icon: '📊',
          recordCount: 0,
          keyPath: 'quizID,matchID',
          indices: [],
          description: 'Match score summaries and team matchups',
          relatedTables: ['matchDetail', 'teams', 'tournaments']
        },
        {
          name: 'matchDetail',
          displayName: 'Match Event Details',
          icon: '🏆',
          recordCount: 0,
          keyPath: 'quizID,matchID,seqNum',
          indices: [],
          description: 'Detailed match event history (question-by-question)',
          relatedTables: ['matchSummary', 'tournaments']
        },
        {
          name: 'matchStats',
          displayName: 'Player Match Statistics',
          icon: '📈',
          recordCount: 0,
          keyPath: 'playerNumber,quizID,matchID',
          indices: [],
          description: 'Individual player statistics per match',
          relatedTables: ['players', 'matchDetail']
        },
        {
          name: 'tournaments',
          displayName: 'Tournaments',
          icon: '🏅',
          recordCount: 0,
          keyPath: 'tournamentID',
          indices: ['status', 'createdAt'],
          description: 'Tournament definitions and brackets',
          relatedTables: ['matchSummary', 'matchDetail']
        },
        {
          name: 'verses',
          displayName: 'Bible Verses',
          icon: '📖',
          recordCount: 0,
          keyPath: 'chapter,verse',
          indices: [],
          description: 'Bible verse text by chapter and verse',
          relatedTables: ['questionDetail']
        },
        {
          name: 'types',
          displayName: 'Question Types',
          icon: '🔤',
          recordCount: 0,
          keyPath: 'typeID',
          indices: [],
          description: 'Question type definitions (IC, MC, FC, IV, MV, Q)',
          relatedTables: ['questionDetail']
        },
        {
          name: 'parms',
          displayName: 'Match Parameters',
          icon: '⚙️',
          recordCount: 0,
          keyPath: 'book',
          indices: [],
          description: 'Match settings and scoring parameters',
          relatedTables: []
        },
        {
          name: 'questionSelect',
          displayName: 'Question Selection Stats',
          icon: '📊',
          recordCount: 0,
          keyPath: 'selectionID',
          indices: [],
          description: 'Question usage statistics and selection tracking',
          relatedTables: ['questionDetail']
        }
      ];

      // Get actual record counts
      for (const table of this.tables) {
        try {
          const count = await this.getTableCount(table.name);
          table.recordCount = count;
        } catch (error) {
          console.warn(`Could not get count for ${table.name}:`, error);
          table.recordCount = 0;
        }
      }
    } catch (error) {
      console.error('Error loading table info:', error);
      alert('Error loading database information. Check console for details.');
    } finally {
      this.isLoading = false;
    }
  }

  async getTableCount(tableName: string): Promise<number> {
    const db = await this.dbService.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const countRequest = store.count();

      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
  }

  async selectTable(table: TableInfo) {
    this.selectedTable = table;
    this.viewMode = 'table';
    this.isLoading = true;

    try {
      const records = await this.getTableRecords(table.name);

      // Get column names from first record
      const columns = records.length > 0 ? Object.keys(records[0]) : [];

      this.tableData = {
        tableName: table.name,
        records,
        columns
      };
    } catch (error) {
      console.error(`Error loading data for ${table.name}:`, error);
      alert('Error loading table data. Check console for details.');
    } finally {
      this.isLoading = false;
    }
  }

  async getTableRecords(tableName: string): Promise<any[]> {
    const db = await this.dbService.getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  get filteredRecords(): any[] {
    if (!this.tableData || !this.searchTerm) {
      return this.tableData?.records || [];
    }

    const term = this.searchTerm.toLowerCase();
    return this.tableData.records.filter(record => {
      return Object.values(record).some(value => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    return String(value);
  }

  backToDiagram() {
    this.viewMode = 'diagram';
    this.selectedTable = null;
    this.tableData = null;
    this.searchTerm = '';
  }

  onReturn() {
    this.router.navigate(['/']);
  }

  async exportTable() {
    if (!this.tableData) return;

    const dataStr = JSON.stringify(this.tableData.records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.tableData.tableName}_export.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async refreshData() {
    if (this.selectedTable) {
      await this.selectTable(this.selectedTable);
    } else {
      await this.loadTableInfo();
    }
  }
}
