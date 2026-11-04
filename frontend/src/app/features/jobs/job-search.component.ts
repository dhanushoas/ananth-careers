import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OffcanvasComponent } from '../../shared/ui/offcanvas.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { SectionDividerComponent } from '../../shared/illustrations/section-divider.component';
import { catchError, of } from 'rxjs';
import { JobsService } from '../../core/services/jobs.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import {
  Category,
  EMPLOYMENT_TYPES,
  EmploymentType,
  Industry,
  Job,
  JobSearchQuery,
  JobSort,
  WORK_MODES,
  WorkMode,
} from '../../core/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { SavedJobsState } from './saved-jobs.state';

const SORTS: readonly JobSort[] = ['relevance', 'latest', 'salary_high'];

/** Parses a CSV query param into a list of allowed values. */
export function parseCsv<T extends string>(value: string | undefined | null, allowed: readonly T[]): T[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function toInt(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Converts the route's query params into an API query. Exported for tests. */
export function buildJobQuery(p: Record<string, string | undefined>): JobSearchQuery {
  const sort = p['sort'] as JobSort | undefined;
  return {
    q: p['q']?.trim() || undefined,
    location: p['location']?.trim() || undefined,
    industry: p['industry'] || undefined,
    category: p['category'] || undefined,
    employmentType: parseCsv<EmploymentType>(p['employmentType'], EMPLOYMENT_TYPES),
    workMode: parseCsv<WorkMode>(p['workMode'], WORK_MODES),
    experience: toInt(p['experience']),
    salaryMin: toInt(p['salaryMin']),
    postedWithin: toInt(p['postedWithin']),
    featured: p['featured'] === 'true' ? true : undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: toInt(p['page']) || 1,
    limit: 12,
  };
}

@Component({
  selector: 'app-job-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    OffcanvasComponent,
    IllustrationComponent,
    SectionDividerComponent,
    EmptyStateComponent,
    JobCardComponent,
    PaginatorComponent,
    SkeletonComponent,
    EnumLabelPipe,
  ],
  templateUrl: './job-search.component.html',
  styleUrl: './job-search.component.scss',
})
export default class JobSearchComponent {
  // Query params (bound via withComponentInputBinding)
  readonly q = input<string>();
  readonly location = input<string>();
  readonly industry = input<string>();
  readonly category = input<string>();
  readonly employmentType = input<string>();
  readonly workMode = input<string>();
  readonly experience = input<string>();
  readonly salaryMin = input<string>();
  readonly postedWithin = input<string>();
  readonly featured = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  private readonly router = inject(Router);
  private readonly jobsApi = inject(JobsService);
  private readonly taxonomy = inject(TaxonomyService);
  protected readonly saved = inject(SavedJobsState);

  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly workModes = WORK_MODES;
  protected readonly sorts = SORTS;
  protected readonly salaryOptions = [
    { value: 200000, label: '₹2 L+' },
    { value: 400000, label: '₹4 L+' },
    { value: 600000, label: '₹6 L+' },
    { value: 1000000, label: '₹10 L+' },
    { value: 1500000, label: '₹15 L+' },
    { value: 2500000, label: '₹25 L+' },
  ];
  protected readonly postedOptions = [
    { value: 1, label: 'Last 24 hours' },
    { value: 3, label: 'Last 3 days' },
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' },
  ];
  protected readonly filtersOpen = signal(false);

  protected readonly query = computed(() =>
    buildJobQuery({
      q: this.q(),
      location: this.location(),
      industry: this.industry(),
      category: this.category(),
      employmentType: this.employmentType(),
      workMode: this.workMode(),
      experience: this.experience(),
      salaryMin: this.salaryMin(),
      postedWithin: this.postedWithin(),
      featured: this.featured(),
      sort: this.sort(),
      page: this.page(),
    }),
  );

  protected readonly results = rxResource({ params: () => this.query(), stream: ({ params }) => this.jobsApi.search(params) });
  protected readonly industries = toSignal(this.taxonomy.industries().pipe(catchError(() => of<Industry[]>([]))), {
    initialValue: [] as Industry[],
  });
  private readonly selectedIndustry = computed(() => {
    const v = this.query().industry;
    return v ? (this.industries().find((i) => i.slug === v || i.id === v) ?? null) : null;
  });
  protected readonly categories = rxResource({
    params: () => this.selectedIndustry()?.id,
    stream: ({ params }) => this.taxonomy.categories(params).pipe(catchError(() => of<Category[]>([]))),
  });

  protected readonly searchForm = inject(FormBuilder).nonNullable.group({ q: '', location: '' });

  protected readonly activeFilterCount = computed(() => {
    const q = this.query();
    return (
      (q.industry ? 1 : 0) +
      (q.category ? 1 : 0) +
      (q.employmentType?.length ?? 0) +
      (q.workMode?.length ?? 0) +
      (q.experience !== undefined ? 1 : 0) +
      (q.salaryMin !== undefined ? 1 : 0) +
      (q.postedWithin !== undefined ? 1 : 0) +
      (q.featured ? 1 : 0)
    );
  });

  protected readonly heading = computed(() => {
    const q = this.query();
    const ind = this.selectedIndustry()?.name;
    const parts = [q.q ? `“${q.q}”` : null, ind ? `in ${ind}` : null, q.location ? `near ${q.location}` : null].filter(Boolean);
    return parts.length ? `Jobs ${parts.join(' ')}` : 'All jobs';
  });

  constructor() {
    effect(() => {
      const q = this.query();
      this.searchForm.setValue({ q: q.q ?? '', location: q.location ?? '' }, { emitEvent: false });
    });
  }

  submitSearch(): void {
    const v = this.searchForm.getRawValue();
    this.navigate({ q: v.q.trim() || null, location: v.location.trim() || null });
  }

  setParam(key: keyof JobSearchQuery, value: string | number | null | undefined): void {
    const patch: Record<string, string | number | null> = { [key]: value === '' || value === undefined ? null : value };
    if (key === 'industry') patch['category'] = null;
    this.navigate(patch);
  }

  setFeatured(event: Event): void {
    this.setParam('featured', (event.target as HTMLInputElement).checked ? 'true' : null);
  }

  setFromSelect(key: keyof JobSearchQuery, event: Event): void {
    this.setParam(key, (event.target as HTMLSelectElement).value || null);
  }

  setFromCheckbox(key: 'employmentType' | 'workMode', value: string, event: Event): void {
    this.toggleCsv(key, value, (event.target as HTMLInputElement).checked);
  }

  setFromInput(key: keyof JobSearchQuery, event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.setParam(key, value === '' ? null : value);
  }

  toggleCsv(key:'employmentType' | 'workMode', value: string, checked: boolean): void {
    const current = (this.query()[key] ?? []) as string[];
    const next = checked ? [...new Set([...current, value])] : current.filter((v) => v !== value);
    this.navigate({ [key]: next.length ? next.join(',') : null });
  }

  isChecked(key: 'employmentType' | 'workMode', value: string): boolean {
    return ((this.query()[key] ?? []) as string[]).includes(value);
  }

  clearFilters(): void {
    const q = this.query();
    void this.router.navigate([], { queryParams: { q: q.q ?? null, location: q.location ?? null, sort: q.sort ?? null } });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { queryParams: { page: e.page > 1 ? e.page : null }, queryParamsHandling: 'merge' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSave(job: Job): void {
    if (this.saved.canSave()) {
      this.saved.toggle(job).subscribe();
    }
  }

  private navigate(patch: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: { ...patch, page: null }, queryParamsHandling: 'merge' });
  }
}
