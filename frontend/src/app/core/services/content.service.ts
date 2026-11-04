import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService } from '../http/api.service';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { ContactRequest, ContentKey, ContentValue, PublicStats, Testimonial } from '../models';

/**
 * The contract says GET /content/:key returns the stored JSON value. Some implementations wrap
 * it as `{ key, value }`; both forms are accepted.
 */
export function unwrapContent(data: unknown): ContentValue | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  if ('value' in record && typeof record['value'] === 'object' && record['value'] !== null && 'key' in record) {
    return record['value'] as ContentValue;
  }
  return record;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly api = inject(ApiService);
  private readonly silent = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /** Content for a key; emits `null` when the key is missing so pages can fall back gracefully. */
  content(key: ContentKey): Observable<ContentValue | null> {
    return this.api.get<unknown>(`/content/${key}`, { context: this.silent }).pipe(
      map(unwrapContent),
      catchError(() => of(null)),
    );
  }

  testimonials(): Observable<Testimonial[]> {
    return this.api.get<Testimonial[]>('/testimonials', { context: this.silent });
  }

  publicStats(): Observable<PublicStats> {
    return this.api.get<PublicStats>('/stats/public', { context: this.silent });
  }

  contact(body: ContactRequest): Observable<unknown> {
    return this.api.post<unknown>('/contact', body, { context: this.silent });
  }
}
