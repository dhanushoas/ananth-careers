import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  Employer,
  EmployerAnalytics,
  EmployerInput,
  EmployerListQuery,
  EmployerProfileResponse,
  EmployerPublic,
  InviteRecruiterRequest,
  Paginated,
  Recruiter,
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EmployersService {
  private readonly api = inject(ApiService);

  list(query: EmployerListQuery = {}): Observable<Paginated<EmployerPublic>> {
    return this.api.get<Paginated<EmployerPublic>>('/employers', { params: query });
  }

  bySlug(slug: string): Observable<EmployerProfileResponse> {
    return this.api.get<EmployerProfileResponse>(`/employers/${encodeURIComponent(slug)}`);
  }

  /** Public logo URL (usable directly in <img src>). */
  logoUrl(employerId: string, cacheBust?: string | number): string {
    const suffix = cacheBust !== undefined ? `?v=${encodeURIComponent(String(cacheBust))}` : '';
    return `${environment.apiUrl}/employers/${employerId}/logo${suffix}`;
  }

  me(): Observable<Employer> {
    return this.api.get<Employer>('/employers/me');
  }

  updateMe(input: EmployerInput): Observable<Employer> {
    return this.api.put<Employer>('/employers/me', input);
  }

  uploadLogo(file: File): Observable<Employer> {
    return this.api.upload<Employer>('/employers/me/logo', file);
  }

  analytics(): Observable<EmployerAnalytics> {
    return this.api.get<EmployerAnalytics>('/employers/me/analytics');
  }

  recruiters(): Observable<Recruiter[]> {
    return this.api.get<Recruiter[]>('/employers/me/recruiters');
  }

  inviteRecruiter(body: InviteRecruiterRequest): Observable<Recruiter> {
    return this.api.post<Recruiter>('/employers/me/recruiters', body);
  }

  deactivateRecruiter(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/employers/me/recruiters/${id}`);
  }
}
