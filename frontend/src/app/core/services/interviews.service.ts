import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import { Interview, InterviewInput, InterviewQuery, InterviewRescheduleInput } from '../models';

@Injectable({ providedIn: 'root' })
export class InterviewsService {
  private readonly api = inject(ApiService);

  schedule(input: InterviewInput): Observable<Interview> {
    return this.api.post<Interview>('/interviews', input);
  }

  /** Jobseeker's own interviews. */
  mine(upcoming?: boolean): Observable<Interview[]> {
    return this.api.get<Interview[]>('/interviews/mine', { params: { upcoming } });
  }

  /** Company interviews (employer/recruiter). */
  list(query: InterviewQuery = {}): Observable<Interview[]> {
    return this.api.get<Interview[]>('/interviews', { params: query });
  }

  reschedule(id: string, input: InterviewRescheduleInput): Observable<Interview> {
    return this.api.patch<Interview>(`/interviews/${id}`, input);
  }

  cancel(id: string, reason?: string): Observable<Interview> {
    return this.api.post<Interview>(`/interviews/${id}/cancel`, { reason: reason || undefined });
  }

  complete(id: string, feedback?: string): Observable<Interview> {
    return this.api.post<Interview>(`/interviews/${id}/complete`, { feedback: feedback || undefined });
  }

  respond(id: string, response: 'accepted' | 'declined', note?: string): Observable<Interview> {
    return this.api.post<Interview>(`/interviews/${id}/respond`, { response, note: note || undefined });
  }
}
