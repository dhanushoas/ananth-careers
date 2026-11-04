import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { TaxonomyService } from '../../../core/services/taxonomy.service';
import {
  AVAILABILITY,
  Availability,
  CANDIDATE_STAGES,
  CAREER_LEVELS,
  CandidateSearchQuery,
  CandidateStage,
  CareerLevel,
  EMPLOYMENT_TYPES,
  EmploymentType,
  Industry,
  RecruiterOption,
  STAGE_LABELS,
  WORK_MODES,
  WorkMode,
} from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../../shared/components/paginator.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge.component';
import { EnumLabelPipe, enumLabel } from '../../../shared/pipes/enum-label.pipe';
import { OffcanvasComponent } from '../../../shared/ui/offcanvas.component';
import { candidateName, csv, initials, locationText, noticeText, numParam, refName } from './recruiter-utils';

/** Query-param keys used by the search form (all strings in the URL). */
const FILTER_KEYS = [
  'q',
  'role',
  'skills',
  'technicalSkills',
  'softSkills',
  'qualification',
  'specialization',
  'careerLevel',
  'expMin',
  'expMax',
  'currentSalaryMax',
  'expectedSalaryMax',
  'location',
  'workMode',
  'noticeMax',
  'availability',
  'industry',
  'employmentType',
  'completionMin',
  'hasResume',
  'consent',
  'stage',
  'assigned',
  'sort',
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const LABELS: Record<FilterKey, string> = {
  q: 'Keyword',
  role: 'Role',
  skills: 'Skills (all)',
  technicalSkills: 'Technical skills',
  softSkills: 'Soft skills',
  qualification: 'Qualification',
  specialization: 'Specialization',
  careerLevel: 'Career level',
  expMin: 'Min experience',
  expMax: 'Max experience',
  currentSalaryMax: 'Current salary ≤',
  expectedSalaryMax: 'Expected salary ≤',
  location: 'Location',
  workMode: 'Work mode',
  noticeMax: 'Notice ≤ (days)',
  availability: 'Availability',
  industry: 'Industry',
  employmentType: 'Employment type',
  completionMin: 'Profile completion ≥',
  hasResume: 'Resume',
  consent: 'Sharing consent',
  stage: 'Stage',
  assigned: 'Assigned',
  sort: 'Sort',
};

const SORTS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'experience', label: 'Experience' },
  { value: 'completion', label: 'Profile completion' },
] as const;

function toBool(v: string | null): boolean | undefined {
  return v === 'true' ? true : v === 'false' ? false : undefined;
}

/** Converts URL query params into the API query. Exported for tests. */
export function buildCandidateQuery(p: ParamMap): CandidateSearchQuery {
  const s = (k: string): string | undefined => p.get(k)?.trim() || undefined;
  const careerLevel = s('careerLevel');
  const workMode = s('workMode');
  const employmentType = s('employmentType');
  const sort = s('sort');
  return {
    q: s('q'),
    role: s('role'),
    skills: csv(p.get('skills')),
    technicalSkills: csv(p.get('technicalSkills')),
    softSkills: csv(p.get('softSkills')),
    qualification: s('qualification'),
    specialization: s('specialization'),
    careerLevel: (CAREER_LEVELS as readonly string[]).includes(careerLevel ?? '') ? (careerLevel as CareerLevel) : undefined,
    expMin: numParam(p.get('expMin')),
    expMax: numParam(p.get('expMax')),
    currentSalaryMax: numParam(p.get('currentSalaryMax')),
    expectedSalaryMax: numParam(p.get('expectedSalaryMax')),
    location: s('location'),
    workMode: (WORK_MODES as readonly string[]).includes(workMode ?? '') ? (workMode as WorkMode) : undefined,
    noticeMax: numParam(p.get('noticeMax')),
    availability: csv(p.get('availability')).filter((a): a is Availability => (AVAILABILITY as readonly string[]).includes(a)),
    industry: s('industry'),
    employmentType: (EMPLOYMENT_TYPES as readonly string[]).includes(employmentType ?? '') ? (employmentType as EmploymentType) : undefined,
    completionMin: numParam(p.get('completionMin')),
    hasResume: toBool(p.get('hasResume')),
    consent: toBool(p.get('consent')),
    stage: csv(p.get('stage')).filter((st): st is CandidateStage => (CANDIDATE_STAGES as readonly string[]).includes(st)),
    assigned: s('assigned'),
    sort: SORTS.some((x) => x.value === sort) ? (sort as CandidateSearchQuery['sort']) : undefined,
    page: numParam(p.get('page')) ?? 1,
    limit: 20,
  };
}

@Component({
  selector: 'app-candidate-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginatorComponent,
    SkeletonComponent,
    StageBadgeComponent,
    EnumLabelPipe,
    OffcanvasComponent,
  ],
  templateUrl: './candidate-search.component.html',
  styleUrl: './candidate-search.component.scss',
})
export default class CandidateSearchComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RecruitmentService);

  protected readonly careerLevels = CAREER_LEVELS;
  protected readonly workModes = WORK_MODES;
  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly availabilityOptions = AVAILABILITY;
  protected readonly stageOptions = CANDIDATE_STAGES;
  protected readonly stageLabels = STAGE_LABELS;
  protected readonly sorts = SORTS;

  protected readonly filtersOpen = signal(false);
  protected readonly selected = signal<string[]>([]);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly query = computed(() => buildCandidateQuery(this.params()));
  protected readonly results = rxResource({ params: () => this.query(), stream: ({ params }) => this.api.candidates(params) });

  protected readonly industries = toSignal(inject(TaxonomyService).industries().pipe(catchError(() => of<Industry[]>([]))), {
    initialValue: [] as Industry[],
  });
  protected readonly recruiters = toSignal(this.api.recruiters().pipe(catchError(() => of<RecruiterOption[]>([]))), {
    initialValue: [] as RecruiterOption[],
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    q: '',
    role: '',
    skills: '',
    technicalSkills: '',
    softSkills: '',
    qualification: '',
    specialization: '',
    careerLevel: '',
    expMin: '',
    expMax: '',
    currentSalaryMax: '',
    expectedSalaryMax: '',
    location: '',
    workMode: '',
    noticeMax: '',
    industry: '',
    employmentType: '',
    completionMin: '',
    hasResume: '',
    consent: '',
    assigned: '',
    sort: '',
  });
  /** Multi-selects kept as signals (rendered as checkbox grids). */
  protected readonly availability = signal<string[]>([]);
  protected readonly stages = signal<string[]>([]);

  /** Active filter chips derived from the URL. */
  protected readonly chips = computed(() => {
    const p = this.params();
    const out: { key: FilterKey; text: string }[] = [];
    for (const key of FILTER_KEYS) {
      const v = p.get(key);
      if (!v || key === 'sort') continue;
      out.push({ key, text: `${LABELS[key]}: ${this.display(key, v)}` });
    }
    return out;
  });

  protected readonly name = candidateName;
  protected readonly initials = initials;
  protected readonly loc = locationText;
  protected readonly notice = noticeText;
  protected readonly recruiterName = refName;

  constructor() {
    // Mirror URL → form whenever the query params change.
    effect(() => {
      const p = this.params();
      untracked(() => {
        for (const key of Object.keys(this.form.controls)) {
          this.form.get(key)?.setValue(p.get(key) ?? '', { emitEvent: false });
        }
        this.availability.set(csv(p.get('availability')));
        this.stages.set(csv(p.get('stage')));
      });
    });
  }

  private display(key: FilterKey, v: string): string {
    switch (key) {
      case 'stage':
        return csv(v)
          .map((s) => STAGE_LABELS[s as CandidateStage] ?? s)
          .join(', ');
      case 'availability':
      case 'careerLevel':
      case 'workMode':
      case 'employmentType':
        return csv(v).map(enumLabel).join(', ');
      case 'industry':
        return this.industries().find((i) => i.id === v || i.slug === v)?.name ?? v;
      case 'assigned':
        return v === 'me' ? 'Me' : v === 'unassigned' ? 'Unassigned' : (this.recruiters().find((r) => r.id === v)?.name ?? v);
      case 'hasResume':
        return v === 'true' ? 'Has resume' : 'No resume';
      case 'consent':
        return v === 'true' ? 'Consented' : 'Not consented';
      case 'completionMin':
        return `${v}%`;
      case 'currentSalaryMax':
      case 'expectedSalaryMax':
        return `₹${Number(v).toLocaleString('en-IN')}`;
      default:
        return v;
    }
  }

  toggleMulti(which: 'availability' | 'stages', value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const sig = which === 'availability' ? this.availability : this.stages;
    sig.update((list) => (checked ? [...new Set([...list, value])] : list.filter((v) => v !== value)));
  }

  apply(): void {
    const v = this.form.getRawValue();
    const params: Record<string, string | null> = {};
    for (const [k, val] of Object.entries(v)) {
      params[k] = val.trim() || null;
    }
    params['availability'] = this.availability().join(',') || null;
    params['stage'] = this.stages().join(',') || null;
    params['page'] = null;
    this.filtersOpen.set(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }

  search(): void {
    const q = this.form.controls.q.value.trim();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q || null, page: null }, queryParamsHandling: 'merge' });
  }

  setSort(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { sort: sort || null, page: null }, queryParamsHandling: 'merge' });
  }

  removeChip(key: FilterKey): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [key]: null, page: null }, queryParamsHandling: 'merge' });
  }

  clearAll(): void {
    const sort = this.params().get('sort');
    void this.router.navigate([], { relativeTo: this.route, queryParams: sort ? { sort } : {} });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: e.page > 1 ? e.page : null }, queryParamsHandling: 'merge' });
  }

  isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  toggleSelect(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.update((list) => (checked ? (list.length >= 4 ? list : [...list, id]) : list.filter((x) => x !== id)));
    if (checked && !this.selected().includes(id)) {
      (event.target as HTMLInputElement).checked = false;
    }
  }

  compare(): void {
    const ids = this.selected();
    if (ids.length >= 2 && ids.length <= 4) {
      void this.router.navigate(['/recruiter/compare'], { queryParams: { ids: ids.join(',') } });
    }
  }

  protected skillPreview(skills: { name: string }[] | undefined): string {
    const list = (skills ?? []).map((s) => s.name);
    return list.length > 4 ? `${list.slice(0, 4).join(', ')} +${list.length - 4}` : list.join(', ');
  }
}

