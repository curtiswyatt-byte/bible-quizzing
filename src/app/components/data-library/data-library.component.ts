import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { DatasetCatalogService } from '../../services/dataset-catalog.service';
import { DirectDataLoaderService } from '../../services/direct-data-loader.service';
import { DatasetInfo } from '../../models/dataset-info.model';

@Component({
  selector: 'app-data-library',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-library.component.html',
  styleUrl: './data-library.component.css'
})
export class DataLibraryComponent implements OnInit {
  datasets: DatasetInfo[] = [];
  activeDatasetId: string | null = null;
  loading = false;
  message = '';
  error = '';

  constructor(
    private datasetCatalog: DatasetCatalogService,
    private dataLoader: DirectDataLoaderService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.datasets = await this.datasetCatalog.getCatalog();
      this.activeDatasetId = this.dataLoader.getActiveDatasetId();
      if (!this.datasets.length) {
        this.error = 'No datasets were found. Add entries to /public/datasets/catalog.json.';
      }
    } catch (error: any) {
      console.error('Failed to load dataset catalog:', error);
      this.error = error?.message || 'Failed to load dataset catalog.';
    }
  }

  async onActivate(dataset: DatasetInfo): Promise<void> {
    if (this.loading || dataset.id === this.activeDatasetId) {
      return;
    }

    this.loading = true;
    this.message = '';
    this.error = '';

    try {
      await this.dataLoader.loadDataset(dataset, { persistSelection: true, resetMatch: true });
      this.activeDatasetId = dataset.id;
      this.message = `${dataset.book} (${dataset.version}) is now active.`;
    } catch (error: any) {
      console.error('Failed to activate dataset:', error);
      this.error = error?.message || 'Failed to activate dataset.';
    } finally {
      this.loading = false;
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}


