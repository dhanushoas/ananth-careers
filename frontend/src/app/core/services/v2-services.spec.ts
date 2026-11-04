import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RecruitmentService } from './recruitment.service';
import { CandidateService } from './candidate.service';
import { EmployerPortalService } from './employer-portal.service';

const ok = <T>(data: T) => ({ success: true, message: 'ok', data, timestamp: '' });

describe('v2 API services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('RecruitmentService.candidates sends advanced filters (CSV arrays, booleans, empty values dropped)', () => {
    TestBed.inject(RecruitmentService)
      .candidates({
        q: 'angular',
        skills: ['Angular', 'TypeScript'],
        availability: ['immediate', 'within_15_days'],
        stage: ['screening'],
        careerLevel: 'experienced',
        expMin: 2,
        consent: true,
        hasResume: false,
        location: '',
        assigned: 'me',
        sort: 'relevance',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/api/v1/recruitment/candidates');
    const p = req.request.params;
    expect(p.get('skills')).toBe('Angular,TypeScript');
    expect(p.get('availability')).toBe('immediate,within_15_days');
    expect(p.get('stage')).toBe('screening');
    expect(p.get('expMin')).toBe('2');
    expect(p.get('consent')).toBe('true');
    expect(p.get('hasResume')).toBe('false');
    expect(p.get('assigned')).toBe('me');
    expect(p.has('location')).toBe(false);
    req.flush(ok({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }));
  });

  it('RecruitmentService shortlist → approval → submission → interview → status flow hits the contract endpoints', () => {
    const svc = TestBed.inject(RecruitmentService);
    svc.shortlist({ jobId: 'j1', candidateId: 'c1', source: 'match' }).subscribe();
    svc.reviewShortlist('s1', 'approve', 'Good fit').subscribe();
    svc.submit({ shortlistId: 's1', summary: 'Strong Angular profile', shareContact: false }).subscribe();
    svc
      .scheduleInterview({ submissionId: 'sub1', scheduledAt: '2030-01-01T10:00:00.000Z', durationMinutes: 45, mode: 'video', meetingLink: 'https://meet.example/x' })
      .subscribe();
    svc.updateSubmissionStatus('sub1', { status: 'placed', joiningDate: '2030-02-01' }).subscribe();
    svc.matches('j1', { minScore: 50, consentOnly: true }).subscribe();

    const short = http.expectOne({ method: 'POST', url: '/api/v1/recruitment/shortlists' });
    expect(short.request.body).toEqual({ jobId: 'j1', candidateId: 'c1', source: 'match' });
    short.flush(ok({}));
    const appr = http.expectOne({ method: 'PATCH', url: '/api/v1/recruitment/shortlists/s1/approval' });
    expect(appr.request.body).toEqual({ decision: 'approve', note: 'Good fit' });
    appr.flush(ok({}));
    const sub = http.expectOne({ method: 'POST', url: '/api/v1/recruitment/submissions' });
    expect(sub.request.body.shareContact).toBe(false);
    sub.flush(ok({}));
    const iv = http.expectOne({ method: 'POST', url: '/api/v1/recruitment/interviews' });
    expect(iv.request.body.mode).toBe('video');
    iv.flush(ok({}));
    const st = http.expectOne({ method: 'PATCH', url: '/api/v1/recruitment/submissions/sub1/status' });
    expect(st.request.body).toEqual({ status: 'placed', joiningDate: '2030-02-01' });
    st.flush(ok({}));
    const m = http.expectOne((r) => r.url === '/api/v1/recruitment/requirements/j1/matches');
    expect(m.request.params.get('minScore')).toBe('50');
    expect(m.request.params.get('consentOnly')).toBe('true');
    m.flush(ok({ items: [] }));
  });

  it('CandidateService consent and apply use /candidates/me', () => {
    const svc = TestBed.inject(CandidateService);
    svc.updateConsent({ profileSharing: true, contactSharing: false }).subscribe();
    svc.apply({ jobId: 'j9' }).subscribe();
    const c = http.expectOne({ method: 'PUT', url: '/api/v1/candidates/me/consent' });
    expect(c.request.body).toEqual({ profileSharing: true, contactSharing: false });
    c.flush(ok({ current: { profileSharing: true, contactSharing: false }, version: '1', history: [] }));
    const a = http.expectOne({ method: 'POST', url: '/api/v1/candidates/me/applications' });
    expect(a.request.body).toEqual({ jobId: 'j9' });
    a.flush(ok({}));
  });

  it('EmployerPortalService decisions and interview requests', () => {
    const svc = TestBed.inject(EmployerPortalService);
    svc.decide('s1', 'accept').subscribe();
    svc.requestInterview('s1', 'Mornings preferred', []).subscribe();
    const d = http.expectOne({ method: 'POST', url: '/api/v1/employer/submissions/s1/decision' });
    expect(d.request.body).toEqual({ decision: 'accept' });
    d.flush(ok({}));
    const r = http.expectOne({ method: 'POST', url: '/api/v1/employer/submissions/s1/interview-request' });
    expect(r.request.body).toEqual({ note: 'Mornings preferred' });
    r.flush(ok({}));
  });
});
