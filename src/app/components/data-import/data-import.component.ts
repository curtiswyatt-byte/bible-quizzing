import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataImportService, ImportProgress } from '../../services/data-import.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-data-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-import.component.html',
  styleUrl: './data-import.component.css'
})
export class DataImportComponent implements OnInit, OnDestroy {
  importType: 'json' | 'csv' = 'json';
  csvDataType: 'players' | 'questions' | 'verses' = 'players';
  selectedFile: File | null = null;
  importStatus: string = '';
  isImporting = false;
  importProgress: ImportProgress | null = null;
  private progressSubscription?: Subscription;

  constructor(
    private importService: DataImportService,
    private router: Router
  ) {}

  ngOnDestroy() {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }

  async ngOnInit() {
    // Subscribe to progress updates
    this.progressSubscription = this.importService.progress$.subscribe(progress => {
      this.importProgress = progress;
      this.importStatus = `${progress.stepName} (${progress.currentItem}/${progress.totalItems}) - ${progress.percentage}%`;
    });
    
    // Check for auto-import file
    await this.checkForAutoImport();
  }

  async checkForAutoImport() {
    // Wait a bit for database to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try to load the exported data file
    try {
      const response = await fetch('/exported-data/import-data.json');
      if (response.ok) {
        const data = await response.json();
        if (data.players && data.players.length > 0) {
          const shouldImport = confirm(
            `Found ${data.players.length} players, ${data.questions?.length || 0} questions, ${data.quizSets?.length || 0} quiz sets, and ${data.teams?.length || 0} teams to import.\n\nWould you like to import this data now?`
          );
          if (shouldImport) {
            this.isImporting = true;
            this.importProgress = null;
            this.importStatus = 'Starting import...';
            try {
              await this.importService.importData(data);
              
              this.importStatus = `✅ Successfully imported ${data.players.length} players, ${data.questions?.length || 0} questions, ${data.verses?.length || 0} verses, ${data.quizSets?.length || 0} quiz sets, and ${data.teams?.length || 0} teams!`;
              setTimeout(() => {
                this.router.navigate(['/']);
              }, 2000);
            } catch (error: any) {
              this.importStatus = `❌ Import failed: ${error?.message || error}`;
              console.error('Import error:', error);
              alert(`Import failed: ${error?.message || error}\n\nPlease check the browser console for details.`);
            } finally {
              this.isImporting = false;
              this.importProgress = null;
            }
          }
        }
      }
    } catch (error) {
      // File doesn't exist or can't be accessed, that's okay
      console.log('No auto-import file found');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  async onImport() {
    if (!this.selectedFile) {
      alert('Please select a file');
      return;
    }

    this.isImporting = true;
    this.importProgress = null;
    this.importStatus = 'Initializing database and importing...';

    try {
      if (this.importType === 'json') {
        await this.importService.importFromJSON(this.selectedFile);
        this.importStatus = '✅ Import completed successfully!';
      } else {
        await this.importService.importFromCSV(this.selectedFile, this.csvDataType);
        this.importStatus = '✅ Import completed successfully!';
      }
      
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 2000);
    } catch (error: any) {
      console.error('Import error:', error);
      const errorMsg = error?.message || error || 'Unknown error';
      this.importStatus = `❌ Import failed: ${errorMsg}`;
      alert(`Import failed: ${errorMsg}\n\nPlease check the browser console for details.`);
    } finally {
      this.isImporting = false;
      this.importProgress = null;
    }
  }

  async onExport() {
    try {
      const data = await this.importService.exportToJSON();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bible-quizzing-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Export completed!');
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error}`);
    }
  }

  async onCreateSample() {
    if (confirm('This will create sample/default data. Continue?')) {
      try {
        await this.importService.createSampleData();
        alert('Sample data created successfully!');
      } catch (error) {
        console.error('Error creating sample data:', error);
        alert(`Error: ${error}`);
      }
    }
  }

  onCancel() {
    this.router.navigate(['/']);
  }
}

