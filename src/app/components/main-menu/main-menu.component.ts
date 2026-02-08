import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { UserFile } from '../../models/player.model';
import { DirectDataLoaderService } from '../../services/direct-data-loader.service';
import { DatasetCatalogService } from '../../services/dataset-catalog.service';
import { DatasetInfo } from '../../models/dataset-info.model';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.css'
})
export class MainMenuComponent implements OnInit {
  title = 'XL Ministries, Inc. Bible Quizzing';
  bookName = '';
  userFile: UserFile | null = null;
  showDatasetSelector = false;
  datasets: DatasetInfo[] = [];
  selectedDatasetId: string = '';
  selectorMode: 'existing' | 'create' = 'existing';
  newBook: string = '';
  newVersion: string = '';
  isBulkImporting = false;
  bulkImportProgress = '';
  bulkImportCurrent = 0;
  bulkImportTotal = 0;

  constructor(
    private router: Router,
    private dbService: DatabaseService,
    private dataLoader: DirectDataLoaderService,
    private catalogService: DatasetCatalogService
  ) {}

  async ngOnInit() {
    this.datasets = await this.catalogService.getCatalog();
    this.userFile = await this.dbService.getUserFile();
    if (this.userFile) {
      if (this.userFile.bookVersion) {
        this.bookName = `${this.userFile.book} (${this.userFile.bookVersion})`;
      } else {
        this.bookName = this.userFile.book;
      }
      this.selectedDatasetId = this.userFile.datasetId || '';
    }
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  toggleDatasetSelector() {
    this.showDatasetSelector = !this.showDatasetSelector;
  }

  async changeDataset() {
    if (!this.selectedDatasetId) return;

    const dataset = this.datasets.find(d => d.id === this.selectedDatasetId);
    if (!dataset) return;

    try {
      await this.dataLoader.loadDataset(dataset, { persistSelection: true, resetMatch: true });

      this.userFile = await this.dbService.getUserFile();
      if (this.userFile) {
        if (this.userFile.bookVersion) {
          this.bookName = `${this.userFile.book} (${this.userFile.bookVersion})`;
        } else {
          this.bookName = this.userFile.book;
        }
      }

      this.showDatasetSelector = false;
    } catch (error) {
      console.error('Error loading dataset:', error);
      alert('Error loading dataset. Please try again.');
    }
  }

  cancelDatasetChange() {
    if (this.userFile) {
      this.selectedDatasetId = this.userFile.datasetId || '';
    }
    this.showDatasetSelector = false;
    this.selectorMode = 'existing';
    this.newBook = '';
    this.newVersion = '';
  }

  async createNewBook() {
    if (!this.newBook.trim() || !this.newVersion.trim()) {
      return;
    }

    try {
      // Create a new UserFile with the specified book and version
      const userFile: UserFile = {
        book: this.newBook.trim(),
        bookVersion: this.newVersion.trim(),
        quizDBname: `${this.newBook.trim()} Dataset`,
        quizIDPre: 'Quiz',
        quizIDNum: '1',
        backupDrive: 'A',
        datasetId: `${this.newBook.trim().toLowerCase().replace(/\s+/g, '-')}-${this.newVersion.trim().toLowerCase().replace(/\s+/g, '-')}`
      };

      await this.dbService.saveUserFile(userFile);

      this.userFile = userFile;
      this.bookName = `${userFile.book} (${userFile.bookVersion})`;

      this.showDatasetSelector = false;
      this.selectorMode = 'existing';
      this.newBook = '';
      this.newVersion = '';

      alert(`Created new book/version: ${userFile.book} (${userFile.bookVersion}). You can now add questions for this book.`);
    } catch (error) {
      console.error('Error creating new book/version:', error);
      alert('Error creating new book/version. Please try again.');
    }
  }

  async bulkImportAllDatasets() {
    if (!confirm(`This will load ALL ${this.datasets.length} datasets into the database.\n\nThis will:\n• Import all questions from all books and versions\n• Import all players from all datasets\n• Import all teams from all datasets\n• Merge everything into one unified database\n\nThis may take a few minutes. Continue?`)) {
      return;
    }

    this.isBulkImporting = true;
    this.bulkImportProgress = 'Starting bulk import...';
    this.bulkImportCurrent = 0;
    this.bulkImportTotal = this.datasets.length;

    try {
      await this.dataLoader.loadAllDatasets((message, current, total) => {
        this.bulkImportProgress = message;
        this.bulkImportCurrent = current;
        this.bulkImportTotal = total;
      });

      this.userFile = await this.dbService.getUserFile();
      if (this.userFile) {
        if (this.userFile.bookVersion) {
          this.bookName = `${this.userFile.book} (${this.userFile.bookVersion})`;
        } else {
          this.bookName = this.userFile.book;
        }
      }

      this.isBulkImporting = false;
      alert('✨ Bulk import complete!\n\nAll datasets have been merged into the database.\nCheck the Database Explorer to see all the data.');
    } catch (error) {
      console.error('Bulk import failed:', error);
      this.isBulkImporting = false;
      alert('Error during bulk import. Check console for details.');
    }
  }
}

