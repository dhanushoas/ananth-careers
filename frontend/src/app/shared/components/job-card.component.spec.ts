import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Job } from '../../core/models';
import { JobCardComponent } from './job-card.component';

const baseJob: Job = {
  id: 'j1',
  slug: 'senior-angular-developer-bengaluru',
  title: 'Senior Angular Developer',
  description: 'Build things',
  responsibilities: [],
  requirements: [],
  skills: ['Angular', 'TypeScript', 'RxJS', 'Signals', 'SCSS'],
  qualifications: [],
  industry: { id: 'i1', name: 'IT & Software', slug: 'it-software' },
  employer: { id: 'e1', companyName: 'Northwind Technologies', slug: 'northwind', hasLogo: false, verificationStatus: 'verified' },
  employmentType: 'full_time',
  workMode: 'hybrid',
  locations: [{ city: 'Bengaluru', state: 'Karnataka', country: 'India' }],
  experience: { min: 3, max: 6 },
  salary: { min: 1200000, max: 2000000, currency: 'INR', period: 'yearly', disclosed: true },
  openings: 2,
  status: 'published',
  featured: true,
  applicationsCount: 4,
  views: 100,
  publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('JobCardComponent', () => {
  let fixture: ComponentFixture<JobCardComponent>;
  let el: HTMLElement;

  async function render(job: Job, extra: Record<string, unknown> = {}): Promise<void> {
    fixture.componentRef.setInput('job', job);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [JobCardComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(JobCardComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders title link, company, location, salary, experience and tags', async () => {
    await render(baseJob);
    const link = el.querySelector('h3 a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Senior Angular Developer');
    expect(link.getAttribute('href')).toBe('/jobs/senior-angular-developer-bengaluru');
    const text = el.textContent ?? '';
    expect(text).toContain('Northwind Technologies');
    expect(text).toContain('Bengaluru, Karnataka');
    expect(text).toContain('₹12 L – 20 L / year');
    expect(text).toContain('3–6 yrs');
    expect(text).toContain('Full-time');
    expect(text).toContain('Hybrid');
    expect(text).toContain('Featured');
    expect(text).toContain('Posted 2 days ago');
    expect(text).toContain('+1');
    expect(el.querySelector('[aria-label="Verified employer"]')).not.toBeNull();
  });

  it('shows "Fresher" for 0–0 experience, hides salary when undisclosed and shows Applied state', async () => {
    await render({
      ...baseJob,
      featured: false,
      experience: { min: 0, max: 0 },
      salary: { ...baseJob.salary, disclosed: false },
      hasApplied: true,
    });
    const text = el.textContent ?? '';
    expect(text).toContain('Fresher');
    expect(text).toContain('Not disclosed');
    expect(text).toContain('Applied');
    expect(text).not.toContain('Featured');
  });

  it('only shows the save button when enabled and emits saveToggle with the job', async () => {
    await render(baseJob);
    expect(el.querySelector('button.save')).toBeNull();

    await render(baseJob, { showSave: true, saved: false });
    const btn = el.querySelector('button.save') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Save Senior Angular Developer');

    const emitted: Job[] = [];
    fixture.componentInstance.saveToggle.subscribe((j) => emitted.push(j));
    btn.click();
    expect(emitted).toEqual([baseJob]);

    await render(baseJob, { saved: true });
    expect((el.querySelector('button.save') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });
});
