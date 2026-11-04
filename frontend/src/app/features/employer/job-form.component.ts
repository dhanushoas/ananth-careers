import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, of, switchMap } from 'rxjs';
import { JobsService } from '../../core/services/jobs.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ToastService } from '../../core/services/toast.service';
import { toAppError } from '../../core/http/api-error';
import { Category, EMPLOYMENT_TYPES, EmploymentType, Job, JobInput, SalaryPeriod, WORK_MODES, WorkMode } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import {
  applyServerErrors,
  csvToList,
  emptyToUndefined,
  linesToList,
  minMaxValidator,
  numberOrUndefined,
  toDateInput,
} from '../../shared/utils/form-utils';
import { CompanyContextService } from './company-context.service';

type LocationGroup = FormGroup<{ city: FormControl<string>; state: FormControl<string>; country: FormControl<string> }>;

@Component({
  selector: 'app-requirement-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, StatusChipComponent, EnumLabelPipe],
  templateUrl: './job-form.component.html',
  styleUrl: './job-form.component.scss',
})
export default class RequirementFormComponent implements OnInit {
  /** Route param (component input binding). Absent on /jobs/new. */
  readonly id = input<string>();

  protected readonly ctx = inject(CompanyContextService);
  private readonly jobsApi = inject(JobsService);
  private readonly taxonomy = inject(TaxonomyService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly workModes = WORK_MODES;
  protected readonly industries = toSignal(this.taxonomy.industries().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly categories = signal<Category[]>([]);
  protected readonly job = signal<Job | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = computed(() => !!this.id());
  /** Contract v2: submitting for approval requires a verified company; drafts are always allowed. */
  protected readonly submitBlocked = computed(() => !!this.ctx.employer() && !this.ctx.companyVerified());
  protected readonly canSubmit = computed(() => !this.isEdit() || ['draft', 'rejected'].includes(this.job()?.status ?? ''));
  protected readonly returnsToApproval = computed(() => ['published', 'rejected'].includes(this.job()?.status ?? ''));
  protected readonly today = toDateInput(new Date().toISOString());

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(10000)]],
    responsibilities: [''],
    requirements: [''],
    qualifications: [''],
    skills: [''],
    industry: ['', Validators.required],
    category: [''],
    employmentType: ['full_time' as EmploymentType, Validators.required],
    workMode: ['onsite' as WorkMode, Validators.required],
    locations: this.fb.array<LocationGroup>([this.locationGroup()], Validators.minLength(1)),
    experience: this.fb.group(
      {
        min: [0, [Validators.required, Validators.min(0), Validators.max(50)]],
        max: [2, [Validators.required, Validators.min(0), Validators.max(50)]],
      },
      { validators: minMaxValidator('min', 'max') },
    ),
    salary: this.fb.group(
      {
        min: [null as number | null, Validators.min(0)],
        max: [null as number | null, Validators.min(0)],
        period: ['yearly' as SalaryPeriod],
        disclosed: [true],
      },
      { validators: minMaxValidator('min', 'max') },
    ),
    openings: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    noticePeriodMaxDays: [null as number | null, [Validators.min(0), Validators.max(365)]],
    confidential: [false],
    applicationDeadline: [''],
  });

  get locations(): FormArray<LocationGroup> {
    return this.form.controls.locations;
  }

  ngOnInit(): void {
    this.form.controls.industry.valueChanges
      .pipe(
        switchMap((id) => (id ? this.taxonomy.categories(id).pipe(catchError(() => of([] as Category[]))) : of([] as Category[]))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cats) => {
        this.categories.set(cats.filter((c) => c.active !== false));
        const current = this.form.controls.category.value;
        if (current && !cats.some((c) => c.id === current)) {
          this.form.controls.category.setValue('');
        }
      });

    const id = this.id();
    if (id) {
      this.loadJob(id);
    }
  }

  loadJob(id: string): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.jobsApi
      .get(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => {
          this.job.set(job);
          this.patch(job);
        },
        error: () => this.loadError.set(true),
      });
  }

  addLocation(): void {
    this.locations.push(this.locationGroup());
  }

  removeLocation(i: number): void {
    if (this.locations.length > 1) {
      this.locations.removeAt(i);
    }
  }

  /** mode: 'draft' (create as draft), 'submit' (create/submit), 'save' (PATCH only), 'saveSubmit' (PATCH + submit). */
  save(mode: 'draft' | 'submit' | 'save' | 'saveSubmit'): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please fix the highlighted fields.');
      return;
    }
    const body = this.toInput();
    const id = this.id();
    let req$: Observable<Job>;
    let message: string;
    if (!id) {
      req$ = this.jobsApi.create(body, mode === 'submit');
      message = mode === 'submit' ? 'Requirement submitted for approval' : 'Draft saved';
    } else if (mode === 'saveSubmit') {
      req$ = this.jobsApi.update(id, body).pipe(switchMap(() => this.jobsApi.submit(id)));
      message = 'Requirement submitted for approval';
    } else {
      req$ = this.jobsApi.update(id, body);
      message = this.returnsToApproval() ? 'Requirement updated and sent for approval' : 'Requirement updated';
    }
    this.saving.set(true);
    req$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(message);
          void this.router.navigate(['/employer/requirements']);
        },
        error: (err: unknown) => {
          const e = toAppError(err);
          if (e.errorCode === 'COMPANY_NOT_VERIFIED') {
            this.formError.set('Your company must be verified by Veejee Services before requirements can be submitted for approval. Save it as a draft for now.');
            return;
          }
          const rest = applyServerErrors(this.form, e);
          this.formError.set(rest.length ? rest.join(' ') : e.details.length ? 'Please review the highlighted fields.' : e.message);
        },
      });
  }

  private toInput(): JobInput {
    const v = this.form.getRawValue();
    const deadline = v.applicationDeadline ? new Date(`${v.applicationDeadline}T23:59:59`).toISOString() : undefined;
    return {
      title: v.title.trim(),
      description: v.description.trim(),
      responsibilities: linesToList(v.responsibilities),
      requirements: linesToList(v.requirements),
      qualifications: linesToList(v.qualifications),
      skills: csvToList(v.skills),
      industry: v.industry,
      category: v.category || undefined,
      employmentType: v.employmentType,
      workMode: v.workMode,
      locations: v.locations.map((l) => ({ city: l.city.trim(), state: emptyToUndefined(l.state), country: l.country.trim() || 'India' })),
      experience: { min: Number(v.experience.min), max: Number(v.experience.max) },
      salary: {
        min: numberOrUndefined(v.salary.min),
        max: numberOrUndefined(v.salary.max),
        currency: 'INR',
        period: v.salary.period,
        disclosed: v.salary.disclosed,
      },
      openings: Number(v.openings),
      noticePeriodMaxDays: numberOrUndefined(v.noticePeriodMaxDays),
      confidential: v.confidential,
      applicationDeadline: deadline,
    };
  }

  private patch(job: Job): void {
    while (this.locations.length) this.locations.removeAt(0);
    (job.locations.length ? job.locations : [{ city: '', state: '', country: 'India' }]).forEach((l) =>
      this.locations.push(this.locationGroup(l.city, l.state ?? '', l.country)),
    );
    this.form.patchValue({
      title: job.title,
      description: job.description,
      responsibilities: job.responsibilities.join('\n'),
      requirements: job.requirements.join('\n'),
      qualifications: job.qualifications.join('\n'),
      skills: job.skills.join(', '),
      industry: job.industry?.id ?? '',
      employmentType: job.employmentType,
      workMode: job.workMode,
      experience: { min: job.experience?.min ?? 0, max: job.experience?.max ?? 0 },
      salary: {
        min: job.salary?.min ?? null,
        max: job.salary?.max ?? null,
        period: job.salary?.period ?? 'yearly',
        disclosed: job.salary?.disclosed ?? true,
      },
      openings: job.openings ?? 1,
      noticePeriodMaxDays: job.noticePeriodMaxDays ?? null,
      confidential: job.confidential ?? false,
      applicationDeadline: toDateInput(job.applicationDeadline),
    });
    // Set category after the industry change has loaded categories.
    this.form.controls.category.setValue(job.category?.id ?? '');
  }

  private locationGroup(city = '', state = '', country = 'India'): LocationGroup {
    return this.fb.group({
      city: [city, [Validators.required, Validators.maxLength(100)]],
      state: [state, Validators.maxLength(100)],
      country: [country, [Validators.required, Validators.maxLength(100)]],
    });
  }
}
