import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import { Job, JobInput, JobSearchQuery, MyJobsQuery, Paginated } from '../models';

@Injectable({ providedIn: 'root' })
export class JobsService {
  private readonly api = inject(ApiService);

  search(query: JobSearchQuery = {}): Observable<Paginated<Job>> {
    return this.api.get<Paginated<Job>>('/jobs', { params: query });
  }

  featured(): Observable<Job[]> {
    return this.api.get<Job[]>('/jobs/featured');
  }

  mine(query: MyJobsQuery = {}): Observable<Paginated<Job>> {
    return this.api.get<Paginated<Job>>('/jobs/mine', { params: query });
  }

  get(idOrSlug: string): Observable<Job> {
    return this.api.get<Job>(`/jobs/${encodeURIComponent(idOrSlug)}`);
  }

  create(input: JobInput, submit = false): Observable<Job> {
    return this.api.post<Job>('/jobs', { ...input, submit });
  }

  update(id: string, input: Partial<JobInput>): Observable<Job> {
    return this.api.patch<Job>(`/jobs/${id}`, input);
  }

  submit(id: string): Observable<Job> {
    return this.api.post<Job>(`/jobs/${id}/submit`);
  }

  close(id: string): Observable<Job> {
    return this.api.post<Job>(`/jobs/${id}/close`);
  }

  reopen(id: string): Observable<Job> {
    return this.api.post<Job>(`/jobs/${id}/reopen`);
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/jobs/${id}`);
  }
}
