import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  CandidateApplication,
  CandidateApplicationStatus,
  CandidateDashboard,
  CandidateInterview,
  CandidateProfile,
  CandidateProfileInput,
  CandidateSubmission,
  ConsentResponse,
  Job,
  PageQuery,
  Paginated,
} from '../models';

/** Candidate portal endpoints: /candidates/me/* (role `candidate`). */
@Injectable({ providedIn: 'root' })
export class CandidateService {
  private readonly api = inject(ApiService);

  profile(): Observable<CandidateProfile> {
    return this.api.get<CandidateProfile>('/candidates/me');
  }

  updateProfile(input: CandidateProfileInput): Observable<CandidateProfile> {
    return this.api.put<CandidateProfile>('/candidates/me', input);
  }

  dashboard(): Observable<CandidateDashboard> {
    return this.api.get<CandidateDashboard>('/candidates/me/dashboard');
  }

  consent(): Observable<ConsentResponse> {
    return this.api.get<ConsentResponse>('/candidates/me/consent');
  }

  /** Contact sharing requires profile sharing (server-enforced). */
  updateConsent(body: { profileSharing?: boolean; contactSharing?: boolean }): Observable<ConsentResponse> {
    return this.api.put<ConsentResponse>('/candidates/me/consent', body);
  }

  applications(query: PageQuery & { status?: CandidateApplicationStatus } = {}): Observable<Paginated<CandidateApplication>> {
    return this.api.get<Paginated<CandidateApplication>>('/candidates/me/applications', { params: query });
  }

  /** Apply through Veejee Services (defaults to the primary resume). */
  apply(body: { jobId: string; resumeId?: string; coverLetter?: string }): Observable<CandidateApplication> {
    return this.api.post<CandidateApplication>('/candidates/me/applications', body);
  }

  withdraw(id: string, reason?: string): Observable<CandidateApplication> {
    return this.api.post<CandidateApplication>(`/candidates/me/applications/${id}/withdraw`, { reason: reason || undefined });
  }

  /** Companies the candidate's profile was shared with. */
  submissions(): Observable<CandidateSubmission[]> {
    return this.api.get<CandidateSubmission[]>('/candidates/me/submissions');
  }

  interviews(upcoming?: boolean): Observable<CandidateInterview[]> {
    return this.api.get<CandidateInterview[]>('/candidates/me/interviews', { params: { upcoming } });
  }

  respondInterview(id: string, response: 'accepted' | 'declined', note?: string): Observable<CandidateInterview> {
    return this.api.post<CandidateInterview>(`/candidates/me/interviews/${id}/respond`, { response, note: note || undefined });
  }

  savedJobs(query: PageQuery = {}): Observable<Paginated<Job>> {
    return this.api.get<Paginated<Job>>('/candidates/me/saved-jobs', { params: query });
  }

  saveJob(jobId: string): Observable<unknown> {
    return this.api.post<unknown>(`/candidates/me/saved-jobs/${jobId}`);
  }

  unsaveJob(jobId: string): Observable<unknown> {
    return this.api.delete<unknown>(`/candidates/me/saved-jobs/${jobId}`);
  }
}
