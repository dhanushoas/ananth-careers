import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess, QueryParams } from '../models';

export interface RequestOptions {
  params?: QueryParams | object;
  context?: HttpContext;
}

/** Builds HttpParams, dropping empty values and joining arrays as CSV. */
export function toHttpParams(params?: QueryParams | object): HttpParams {
  let httpParams = new HttpParams();
  if (!params) {
    return httpParams;
  }
  for (const [key, raw] of Object.entries(params as Record<string, unknown>)) {
    if (raw === undefined || raw === null || raw === '') {
      continue;
    }
    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        continue;
      }
      httpParams = httpParams.set(key, raw.join(','));
    } else if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      httpParams = httpParams.set(key, String(raw));
    }
  }
  return httpParams;
}

/**
 * Thin wrapper over HttpClient that targets the API base URL and unwraps the
 * `{ success, message, data }` envelope.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), { params: toHttpParams(options.params), context: options.context })
      .pipe(map((res) => res.data));
  }

  post<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Observable<T> {
    return this.http
      .post<ApiSuccess<T>>(this.url(path), body, { params: toHttpParams(options.params), context: options.context })
      .pipe(map((res) => res.data));
  }

  /** Like {@link post} but also returns the server's success message. */
  postWithMessage<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Observable<ApiSuccess<T>> {
    return this.http.post<ApiSuccess<T>>(this.url(path), body, {
      params: toHttpParams(options.params),
      context: options.context,
    });
  }

  put<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Observable<T> {
    return this.http
      .put<ApiSuccess<T>>(this.url(path), body, { params: toHttpParams(options.params), context: options.context })
      .pipe(map((res) => res.data));
  }

  patch<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Observable<T> {
    return this.http
      .patch<ApiSuccess<T>>(this.url(path), body, { params: toHttpParams(options.params), context: options.context })
      .pipe(map((res) => res.data));
  }

  delete<T>(path: string, body?: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http
      .delete<ApiSuccess<T>>(this.url(path), {
        body,
        params: toHttpParams(options.params),
        context: options.context,
      })
      .pipe(map((res) => res.data));
  }

  upload<T>(path: string, file: File, field = 'file'): Observable<T> {
    const form = new FormData();
    form.append(field, file, file.name);
    return this.http.post<ApiSuccess<T>>(this.url(path), form).pipe(map((res) => res.data));
  }

  /** Fetches binary content (resume PDFs, images) with the auth header applied by the interceptor. */
  getBlob(path: string, options: RequestOptions = {}): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url(path), {
      observe: 'response',
      responseType: 'blob',
      params: toHttpParams(options.params),
      context: options.context,
    });
  }
}
