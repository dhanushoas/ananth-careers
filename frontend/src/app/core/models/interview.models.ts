export const INTERVIEW_MODES = ['in_person', 'video', 'phone'] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];
export type InterviewStatus = 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
export type CandidateResponse = 'pending' | 'accepted' | 'declined';

export interface Interview {
  id: string;
  application: string;
  job: { id: string; title: string };
  employer: { id: string; companyName: string };
  candidate: { id: string; name: string };
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  location?: string | null;
  meetingLink?: string | null;
  notes?: string | null;
  status: InterviewStatus;
  candidateResponse: CandidateResponse;
  feedback?: string | null;
  createdAt: string;
}

export interface InterviewInput {
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  location?: string;
  meetingLink?: string;
  notes?: string;
}

export type InterviewRescheduleInput = Omit<InterviewInput, 'applicationId'>;

export interface InterviewQuery {
  upcoming?: boolean;
  status?: InterviewStatus;
}
