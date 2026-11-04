import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JobsService } from './jobs.service';
import { Job, Paginated } from '../models';

describe('JobsService', () => {
  let service: JobsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(JobsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('search() sends filters as query params (CSV for arrays, empty values dropped) and unwraps the envelope', () => {
    const page: Paginated<Job> = { items: [], page: 2, limit: 12, total: 0, totalPages: 0 };
    let result: Paginated<Job> | undefined;
    service
      .search({
        q: 'angular',
        location: '',
        industry: 'it-software',
        employmentType: ['full_time', 'contract'],
        workMode: [],
        experience: 3,
        salaryMin: undefined,
        page: 2,
        limit: 12,
      })
      .subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === '/api/v1/jobs');
    expect(req.request.method).toBe('GET');
    const p = req.request.params;
    expect(p.get('q')).toBe('angular');
    expect(p.get('industry')).toBe('it-software');
    expect(p.get('employmentType')).toBe('full_time,contract');
    expect(p.get('experience')).toBe('3');
    expect(p.get('page')).toBe('2');
    expect(p.has('location')).toBe(false);
    expect(p.has('workMode')).toBe(false);
    expect(p.has('salaryMin')).toBe(false);
    req.flush({ success: true, message: 'ok', data: page, timestamp: '' });

    expect(result).toEqual(page);
  });

  it('create() posts JobInput plus submit flag', () => {
    service
      .create(
        {
          title: 'Dev',
          description: 'd',
          industry: 'i1',
          employmentType: 'full_time',
          workMode: 'onsite',
          locations: [{ city: 'Pune', country: 'India' }],
          experience: { min: 0, max: 2 },
          salary: { currency: 'INR', period: 'yearly', disclosed: false },
        },
        true,
      )
      .subscribe();
    const req = http.expectOne('/api/v1/jobs');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.submit).toBe(true);
    expect(req.request.body.title).toBe('Dev');
    req.flush({ success: true, message: 'ok', data: {}, timestamp: '' });
  });

  it('lifecycle actions hit the contract endpoints', () => {
    service.submit('j1').subscribe();
    service.close('j1').subscribe();
    service.reopen('j1').subscribe();
    service.delete('j1').subscribe();
    service.get('senior-dev-pune').subscribe();
    const flush = (method: string, url: string) =>
      http.expectOne({ method, url }).flush({ success: true, message: 'ok', data: {}, timestamp: '' });
    flush('POST', '/api/v1/jobs/j1/submit');
    flush('POST', '/api/v1/jobs/j1/close');
    flush('POST', '/api/v1/jobs/j1/reopen');
    flush('DELETE', '/api/v1/jobs/j1');
    flush('GET', '/api/v1/jobs/senior-dev-pune');
  });
});
