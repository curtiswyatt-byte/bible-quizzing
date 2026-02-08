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
      this.catalogPromise = firstValueFrom(
        this.http.get<DatasetInfo[]>('datasets/catalog.json')
      ).then((catalog) => catalog ?? []);
    }
    return this.catalogPromise;
  }
}


