import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { DatasetInfo } from '../models/dataset-info.model';

@Injectable({ providedIn: 'root' })
export class DatasetCatalogService {
  private catalogPromise?: Promise<DatasetInfo[]>;

  constructor(private http: HttpClient) {}

  getCatalog(): Promise<DatasetInfo[]> {
    if (!this.catalogPromise) {
      console.log('📚 Loading dataset catalog...');
      this.catalogPromise = firstValueFrom(
        this.http.get<DatasetInfo[]>('datasets/catalog.json')
      ).then((catalog) => {
        console.log(`📚 Loaded ${catalog?.length ?? 0} datasets from catalog`);
        return catalog ?? [];
      }).catch((error) => {
        console.error('❌ Failed to load dataset catalog:', error);
        // Reset the promise so it can be retried
        this.catalogPromise = undefined;
        return [];
      });
    }
    return this.catalogPromise;
  }

  // Force reload the catalog (useful after cache clear)
  reloadCatalog(): Promise<DatasetInfo[]> {
    this.catalogPromise = undefined;
    return this.getCatalog();
  }
}


