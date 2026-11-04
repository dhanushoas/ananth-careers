import { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import { Resume } from '../models';

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_MAX_COUNT = 5;

@Injectable({ providedIn: 'root' })
export class ResumesService {
  private readonly api = inject(ApiService);

  list(): Observable<Resume[]> {
    return this.api.get<Resume[]>('/resumes');
  }

  upload(file: File): Observable<Resume> {
    return this.api.upload<Resume>('/resumes', file);
  }

  makePrimary(id: string): Observable<Resume> {
    return this.api.patch<Resume>(`/resumes/${id}/primary`);
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/resumes/${id}`);
  }

  download(id: string): Observable<HttpResponse<Blob>> {
    return this.api.getBlob(`/resumes/${id}/download`);
  }
}
