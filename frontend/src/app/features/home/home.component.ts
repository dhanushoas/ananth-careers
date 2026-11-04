import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IllustrationComponent, IllustrationName } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { CountUpComponent } from '../../shared/illustrations/count-up.component';
import { SectionDividerComponent } from '../../shared/illustrations/section-divider.component';
import { catchError, map, of } from 'rxjs';
import { ContentService } from '../../core/services/content.service';
import { EmployersService } from '../../core/services/employers.service';
import { JobsService } from '../../core/services/jobs.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { EMPLOYMENT_TYPES, EmployerPublic, HomeContent, Industry, Job, Testimonial } from '../../core/models';
import { EmployerCardComponent } from '../../shared/components/employer-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { IndustryCardComponent } from '../../shared/components/industry-card.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

const DEFAULT_TITLE = 'Your Recruitment Partner – from registration to placement.';
const DEFAULT_SUBTITLE =
  'Register with Veejee Services. Our recruiters screen and shortlist you for suitable roles at our client companies, share your profile only with your consent, and coordinate every interview until you are placed.';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IllustrationComponent,
    RevealDirective,
    CountUpComponent,
    SectionDividerComponent,
    EmployerCardComponent,
    EmptyStateComponent,
    IndustryCardComponent,
    JobCardComponent,
    SkeletonComponent,
    EnumLabelPipe,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export default class HomeComponent {
  private readonly router = inject(Router);
  private readonly content = inject(ContentService);
  private readonly jobsApi = inject(JobsService);
  private readonly employersApi = inject(EmployersService);
  private readonly taxonomy = inject(TaxonomyService);

  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly searchForm = inject(FormBuilder).nonNullable.group({
    q: '',
    location: '',
    industry: '',
    employmentType: '',
  });

  protected readonly homeContent = rxResource({
    stream: () => this.content.content('home').pipe(map((v) => (v ?? {}) as HomeContent)),
  });
  protected readonly heroTitle = computed(() => this.homeContent.value()?.heroTitle || DEFAULT_TITLE);
  protected readonly heroSubtitle = computed(() => this.homeContent.value()?.heroSubtitle || DEFAULT_SUBTITLE);

  protected readonly stats = rxResource({ stream: () => this.content.publicStats().pipe(catchError(() => of(null))) });
  protected readonly statItems = computed(() => {
    const s = this.stats.value();
    if (s) {
      return [
        { label: 'Open job opportunities', value: s.jobs, icon: 'bi-briefcase' },
        { label: 'Client companies', value: s.employers, icon: 'bi-buildings' },
        { label: 'Registered candidates', value: s.jobSeekers, icon: 'bi-people' },
        { label: 'Industries we serve', value: s.industries, icon: 'bi-grid' },
      ];
    }
    // Fallback to admin-curated stats from the "home" content key.
    return (this.homeContent.value()?.stats ?? []).map((st) => ({ label: st.label, value: st.value, icon: 'bi-graph-up' }));
  });

  protected readonly industries = rxResource({ stream: () => this.taxonomy.industries() });
  protected readonly topIndustries = computed<Industry[]>(() =>
    [...(this.industries.value() ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 12),
  );

  protected readonly featuredJobs = rxResource({ stream: () => this.jobsApi.featured() });
  protected readonly jobs = computed<Job[]>(() => this.featuredJobs.value() ?? []);

  protected readonly employers = rxResource({
    stream: () =>
      this.employersApi.list({ featured: true, limit: 8 }).pipe(
        map((res) => res.items),
        catchError(() => of<EmployerPublic[]>([])),
      ),
  });

  protected readonly testimonials = rxResource({
    stream: () => this.content.testimonials().pipe(catchError(() => of<Testimonial[]>([]))),
  });

  protected readonly reasons = [
    { icon: 'bi-shield-check', title: 'Consent-based sharing', text: 'Companies never browse our database. Profiles are shared only for suitable roles, with the candidate’s consent.' },
    { icon: 'bi-person-check', title: 'Screened by recruiters', text: 'Every candidate a company receives has been reviewed and shortlisted by a Veejee Services recruiter.' },
    { icon: 'bi-activity', title: 'Transparent progress', text: 'Candidates and companies follow every step – from screening to interviews to placement.' },
    { icon: 'bi-diagram-3', title: 'Every industry, every level', text: 'Freshers, interns and experienced professionals across 12 industries.' },
  ];

  protected readonly stepArt: IllustrationName[] = ['step-profile', 'step-resume', 'step-apply', 'step-hired'];

  protected readonly seekerSteps = [
    { icon: 'bi-person-plus', title: 'Register & build your profile', text: 'Candidates register free with Veejee Services and add skills, experience and a resume.' },
    { icon: 'bi-search', title: 'Screening & matching', text: 'Our recruiters review profiles and match them to company requirements.' },
    { icon: 'bi-send-check', title: 'Shortlisted & shared', text: 'Shortlisted profiles are shared with the company – only with the candidate’s consent.' },
    { icon: 'bi-trophy', title: 'Interviews to placement', text: 'Veejee Services schedules interviews and supports the candidate until joining.' },
  ];

  protected readonly employerSteps = [
    { icon: 'bi-building-add', title: 'Register your company', text: 'Veejee Services verifies your organisation.' },
    { icon: 'bi-file-earmark-plus', title: 'Post a requirement', text: 'Share the role, vacancies, skills, experience and salary range.' },
    { icon: 'bi-people', title: 'Receive shortlisted candidates', text: 'Review screened, consented profiles submitted by our recruiters.' },
    { icon: 'bi-calendar2-check', title: 'Interview & hire', text: 'Request interviews – we schedule them – then share feedback and select.' },
  ];

  protected toNum(v: string | number): number | null {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
  }

  protected stars(rating: number): number[] {
    const n = Math.max(0, Math.min(5, Math.round(rating)));
    return Array.from({ length: n }, (_, i) => i);
  }

  search(): void {
    const v = this.searchForm.getRawValue();
    void this.router.navigate(['/jobs'], {
      queryParams: {
        q: v.q.trim() || null,
        location: v.location.trim() || null,
        industry: v.industry || null,
        employmentType: v.employmentType || null,
      },
    });
  }
}
