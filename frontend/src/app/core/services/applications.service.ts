import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  Application,
  ApplicationQuery,
  ApplicationStatus,
  ApplyRequest,
  EmployerSettableStatus,
  Message,
  PageQuery,
  Paginated,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly api = inject(ApiService);

  apply(body: ApplyRequest): Observable<Application> {
    return this.api.post<Application>('/applications', body);
  }

  mine(query: PageQuery & { status?: ApplicationStatus } = {}): Observable<Paginated<Application>> {
    return this.api.get<Paginated<Application>>('/applications/mine', { params: query });
  }

  /** Company applications (employer/recruiter) or all (admin with applications:view). */
  list(query: ApplicationQuery = {}): Observable<Paginated<Application>> {
    return this.api.get<Paginated<Application>>('/applications', { params: query });
  }

  get(id: string): Observable<Application> {
    return this.api.get<Application>(`/applications/${id}`);
  }

  updateStatus(id: string, status: EmployerSettableStatus, note?: string): Observable<Application> {
    return this.api.patch<Application>(`/applications/${id}/status`, { status, note: note || undefined });
  }

  withdraw(id: string, reason?: string): Observable<Application> {
    return this.api.post<Application>(`/applications/${id}/withdraw`, { reason: reason || undefined });
  }

  messages(id: string): Observable<Message[]> {
    return this.api.get<Message[]>(`/applications/${id}/messages`);
  }

  sendMessage(id: string, body: string): Observable<Message> {
    return this.api.post<Message>(`/applications/${id}/messages`, { body });
  }
}
