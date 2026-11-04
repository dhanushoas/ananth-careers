import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  CandidateInterview,
  EmployerDashboard,
  EmployerDecision,
  FeedbackRecommendation,
  InterviewFeedback,
  PageQuery,
  Paginated,
  Submission,
  SubmissionStatus,
} from '../models';

/** Employer portal endpoints under /employer/* (submitted candidates, interviews, dashboard). */
@Injectable({ providedIn: 'root' })
export class EmployerPortalService {
  private readonly api = inject(ApiService);

  dashboard(): Observable<EmployerDashboard> {
    return this.api.get<EmployerDashboard>('/employer/dashboard');
  }

  submissions(
    query: PageQuery & { jobId?: string; status?: SubmissionStatus; history?: boolean } = {},
  ): Observable<Paginated<Submission>> {
    return this.api.get<Paginated<Submission>>('/employer/submissions', { params: query });
  }

  /** First view moves `submitted → company_reviewing`. Contact details only when shared. */
  submission(id: string): Observable<Submission> {
    return this.api.get<Submission>(`/employer/submissions/${id}`);
  }

  decide(id: string, decision: EmployerDecision, note?: string): Observable<Submission> {
    return this.api.post<Submission>(`/employer/submissions/${id}/decision`, { decision, note: note || undefined });
  }

  requestInterview(id: string, note?: string, preferredSlots?: string[]): Observable<Submission> {
    return this.api.post<Submission>(`/employer/submissions/${id}/interview-request`, {
      note: note || undefined,
      preferredSlots: preferredSlots?.length ? preferredSlots : undefined,
    });
  }

  interviews(upcoming?: boolean): Observable<CandidateInterview[]> {
    return this.api.get<CandidateInterview[]>('/employer/interviews', { params: { upcoming } });
  }

  feedback(
    interviewId: string,
    body: { rating: number; feedback: string; recommendation: FeedbackRecommendation },
  ): Observable<InterviewFeedback> {
    return this.api.post<InterviewFeedback>(`/employer/interviews/${interviewId}/feedback`, body);
  }
}
