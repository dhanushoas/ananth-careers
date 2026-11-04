import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  CandidateApplication,
  CandidateInterview,
  CandidateProfile,
  CandidateSearchQuery,
  CandidateStage,
  MatchesResponse,
  PageQuery,
  Paginated,
  RecruiterCandidateDetail,
  RecruiterDashboard,
  RecruiterNote,
  RecruiterOption,
  Requirement,
  RequirementDetail,
  ScheduleInterviewInput,
  Shortlist,
  ShortlistStatus,
  Submission,
  SubmissionDetail,
  SubmissionStatus,
} from '../models';

/** Recruiter portal endpoints (/recruitment/*): Veejee Services staff, or admins with `*`/`recruitment:manage`. */
@Injectable({ providedIn: 'root' })
export class RecruitmentService {
  private readonly api = inject(ApiService);

  dashboard(): Observable<RecruiterDashboard> {
    return this.api.get<RecruiterDashboard>('/recruitment/dashboard');
  }

  recruiters(): Observable<RecruiterOption[]> {
    return this.api.get<RecruiterOption[]>('/recruitment/recruiters');
  }

  // ---- candidate database ----
  candidates(query: CandidateSearchQuery = {}): Observable<Paginated<CandidateProfile>> {
    return this.api.get<Paginated<CandidateProfile>>('/recruitment/candidates', { params: query });
  }

  compare(ids: string[]): Observable<CandidateProfile[] | { items: CandidateProfile[] }> {
    return this.api.get<CandidateProfile[] | { items: CandidateProfile[] }>('/recruitment/candidates/compare', {
      params: { ids: ids.join(',') },
    });
  }

  candidate(id: string): Observable<RecruiterCandidateDetail> {
    return this.api.get<RecruiterCandidateDetail>(`/recruitment/candidates/${id}`);
  }

  setStage(id: string, stage: CandidateStage, note?: string, visibleToCandidate?: boolean): Observable<CandidateProfile> {
    return this.api.patch<CandidateProfile>(`/recruitment/candidates/${id}/stage`, {
      stage,
      note: note || undefined,
      visibleToCandidate,
    });
  }

  assignCandidate(id: string, recruiterId: string | null): Observable<CandidateProfile> {
    return this.api.patch<CandidateProfile>(`/recruitment/candidates/${id}/assign`, { recruiterId });
  }

  addNote(candidateId: string, body: string, jobId?: string): Observable<RecruiterNote> {
    return this.api.post<RecruiterNote>(`/recruitment/candidates/${candidateId}/notes`, { body, jobId: jobId || undefined });
  }

  deleteNote(noteId: string): Observable<unknown> {
    return this.api.delete<unknown>(`/recruitment/notes/${noteId}`);
  }

  contactCandidate(candidateId: string, subject: string, message: string): Observable<unknown> {
    return this.api.post<unknown>(`/recruitment/candidates/${candidateId}/contact`, { subject, message });
  }

  // ---- applications (screening queue) ----
  applications(query: PageQuery & { status?: string; jobId?: string } = {}): Observable<Paginated<CandidateApplication>> {
    return this.api.get<Paginated<CandidateApplication>>('/recruitment/applications', { params: query });
  }

  updateApplication(id: string, status: 'under_review' | 'not_shortlisted', note?: string): Observable<CandidateApplication> {
    return this.api.patch<CandidateApplication>(`/recruitment/applications/${id}`, { status, note: note || undefined });
  }

  // ---- requirements ----
  requirements(
    query: PageQuery & { status?: string; q?: string; assigned?: string; employer?: string } = {},
  ): Observable<Paginated<Requirement>> {
    return this.api.get<Paginated<Requirement>>('/recruitment/requirements', { params: query });
  }

  requirement(id: string): Observable<RequirementDetail> {
    return this.api.get<RequirementDetail>(`/recruitment/requirements/${id}`);
  }

  assignRequirement(id: string, recruiterId: string | null): Observable<Requirement> {
    return this.api.patch<Requirement>(`/recruitment/requirements/${id}/assign`, { recruiterId });
  }

  matches(
    id: string,
    query: { minScore?: number; consentOnly?: boolean; includeShortlisted?: boolean } = {},
  ): Observable<MatchesResponse> {
    return this.api.get<MatchesResponse>(`/recruitment/requirements/${id}/matches`, { params: query });
  }

  // ---- shortlists ----
  shortlists(query: PageQuery & { status?: ShortlistStatus; jobId?: string; mine?: boolean } = {}): Observable<Paginated<Shortlist>> {
    return this.api.get<Paginated<Shortlist>>('/recruitment/shortlists', { params: query });
  }

  shortlist(body: { jobId: string; candidateId: string; applicationId?: string; note?: string; source?: 'application' | 'search' | 'match' }): Observable<Shortlist> {
    return this.api.post<Shortlist>('/recruitment/shortlists', body);
  }

  removeShortlist(id: string, reason?: string): Observable<Shortlist> {
    return this.api.post<Shortlist>(`/recruitment/shortlists/${id}/remove`, { reason: reason || undefined });
  }

  /** Admin with `shortlists:approve`. */
  reviewShortlist(id: string, decision: 'approve' | 'reject', note?: string): Observable<Shortlist> {
    return this.api.patch<Shortlist>(`/recruitment/shortlists/${id}/approval`, { decision, note: note || undefined });
  }

  // ---- submissions to companies ----
  submit(body: { shortlistId: string; summary?: string; shareContact?: boolean }): Observable<Submission> {
    return this.api.post<Submission>('/recruitment/submissions', body);
  }

  submissions(
    query: PageQuery & { status?: SubmissionStatus; jobId?: string; employer?: string; mine?: boolean } = {},
  ): Observable<Paginated<Submission>> {
    return this.api.get<Paginated<Submission>>('/recruitment/submissions', { params: query });
  }

  submission(id: string): Observable<SubmissionDetail> {
    return this.api.get<SubmissionDetail>(`/recruitment/submissions/${id}`);
  }

  updateSubmissionStatus(
    id: string,
    body: { status: SubmissionStatus; note?: string; visibleToCandidate?: boolean; joiningDate?: string },
  ): Observable<Submission> {
    return this.api.patch<Submission>(`/recruitment/submissions/${id}/status`, body);
  }

  // ---- interviews ----
  interviews(query: { upcoming?: boolean; status?: string; mine?: boolean } = {}): Observable<CandidateInterview[]> {
    return this.api.get<CandidateInterview[]>('/recruitment/interviews', { params: query });
  }

  scheduleInterview(body: ScheduleInterviewInput): Observable<CandidateInterview> {
    return this.api.post<CandidateInterview>('/recruitment/interviews', body);
  }

  rescheduleInterview(id: string, body: Omit<ScheduleInterviewInput, 'submissionId'>): Observable<CandidateInterview> {
    return this.api.patch<CandidateInterview>(`/recruitment/interviews/${id}`, body);
  }

  cancelInterview(id: string, reason?: string): Observable<CandidateInterview> {
    return this.api.post<CandidateInterview>(`/recruitment/interviews/${id}/cancel`, { reason: reason || undefined });
  }

  completeInterview(id: string): Observable<CandidateInterview> {
    return this.api.post<CandidateInterview>(`/recruitment/interviews/${id}/complete`);
  }
}
