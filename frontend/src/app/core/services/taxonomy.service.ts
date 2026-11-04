import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiService } from '../http/api.service';
import { Category, CategoryInput, Industry, IndustryDetail, IndustryInput } from '../models';

@Injectable({ providedIn: 'root' })
export class TaxonomyService {
  private readonly api = inject(ApiService);
  private industries$?: Observable<Industry[]>;

  /** Active industries (cached for the session; call {@link invalidate} after admin edits). */
  industries(): Observable<Industry[]> {
    this.industries$ ??= this.api.get<Industry[]>('/industries').pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.industries$;
  }

  /** Admin view including inactive industries. */
  allIndustries(): Observable<Industry[]> {
    return this.api.get<Industry[]>('/industries', { params: { all: true } });
  }

  industry(slug: string): Observable<IndustryDetail> {
    return this.api.get<IndustryDetail>(`/industries/${encodeURIComponent(slug)}`);
  }

  categories(industryId?: string): Observable<Category[]> {
    return this.api.get<Category[]>('/categories', { params: { industry: industryId } });
  }

  createIndustry(input: IndustryInput): Observable<Industry> {
    return this.api.post<Industry>('/industries', input);
  }

  updateIndustry(id: string, input: Partial<IndustryInput>): Observable<Industry> {
    return this.api.patch<Industry>(`/industries/${id}`, input);
  }

  deleteIndustry(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/industries/${id}`);
  }

  createCategory(input: CategoryInput): Observable<Category> {
    return this.api.post<Category>('/categories', input);
  }

  updateCategory(id: string, input: Partial<CategoryInput>): Observable<Category> {
    return this.api.patch<Category>(`/categories/${id}`, input);
  }

  deleteCategory(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/categories/${id}`);
  }

  invalidate(): void {
    this.industries$ = undefined;
  }
}
