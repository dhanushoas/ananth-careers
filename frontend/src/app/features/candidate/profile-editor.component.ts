import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import {
  AVAILABILITY,
  Availability,
  CandidateEducation,
  CandidateExperience,
  CandidateProfile,
  CandidateProfileInput,
  CandidateSkill,
  CareerLevel,
  EMPLOYMENT_TYPES,
  EmploymentType,
  Gender,
  Industry,
  SalaryPeriod,
  SkillLevel,
  SkillType,
  WORK_MODES,
  WorkMode,
} from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ToastService } from '../../core/services/toast.service';
import { toAppError } from '../../core/http/api-error';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import {
  applyServerErrors,
  csvToList,
  emptyToUndefined,
  minMaxValidator,
  numberOrUndefined,
  toDateInput,
} from '../../shared/utils/form-utils';

type SkillForm = FormGroup<{
  name: FormControl<string>;
  type: FormControl<SkillType>;
  level: FormControl<SkillLevel | ''>;
}>;
type EducationForm = FormGroup<{
  qualification: FormControl<string>;
  specialization: FormControl<string>;
  institution: FormControl<string>;
  startYear: FormControl<number | null>;
  endYear: FormControl<number | null>;
  grade: FormControl<string>;
}>;
type ExperienceForm = FormGroup<{
  title: FormControl<string>;
  company: FormControl<string>;
  location: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  current: FormControl<boolean>;
  description: FormControl<string>;
}>;

export type ProfileTab = 'personal' | 'education' | 'skills' | 'experience' | 'preferences';

const THIS_YEAR = new Date().getFullYear();

@Component({
  selector: 'app-candidate-profile-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, EnumLabelPipe],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.scss',
})
export default class CandidateProfileEditorComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CandidateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs: { key: ProfileTab; label: string; icon: string }[] = [
    { key: 'personal', label: 'Personal', icon: 'bi-person-vcard' },
    { key: 'education', label: 'Education', icon: 'bi-mortarboard' },
    { key: 'skills', label: 'Skills', icon: 'bi-lightning-charge' },
    { key: 'experience', label: 'Experience', icon: 'bi-briefcase' },
    { key: 'preferences', label: 'Preferences', icon: 'bi-compass' },
  ];
  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly workModes = WORK_MODES;
  protected readonly availabilities = AVAILABILITY;
  protected readonly genders: Gender[] = ['male', 'female', 'other', 'prefer_not_to_say'];
  protected readonly skillLevels: SkillLevel[] = ['beginner', 'intermediate', 'expert'];
  protected readonly periods: SalaryPeriod[] = ['yearly', 'monthly'];
  protected readonly maxYear = THIS_YEAR + 8;
  protected readonly industries = toSignal(
    inject(TaxonomyService)
      .industries()
      .pipe(catchError(() => of<Industry[]>([]))),
    { initialValue: [] as Industry[] },
  );

  protected readonly activeTab = signal<ProfileTab>('personal');
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly profile = signal<CandidateProfile | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    headline: ['', [Validators.maxLength(150)]],
    summary: ['', [Validators.maxLength(2000)]],
    location: this.fb.group({
      city: ['', [Validators.maxLength(100)]],
      state: ['', [Validators.maxLength(100)]],
      country: ['India', [Validators.maxLength(100)]],
    }),
    dateOfBirth: [''],
    gender: this.fb.control<Gender | ''>(''),
    careerLevel: this.fb.control<CareerLevel>('fresher'),
    totalExperienceYears: this.fb.control<number | null>(0, [Validators.min(0), Validators.max(60)]),
    currentSalary: this.fb.control<number | null>(null, [Validators.min(0)]),
    expectedSalary: this.fb.group(
      {
        min: this.fb.control<number | null>(null, [Validators.min(0)]),
        max: this.fb.control<number | null>(null, [Validators.min(0)]),
        period: this.fb.control<SalaryPeriod>('yearly'),
      },
      { validators: [minMaxValidator('min', 'max')] },
    ),
    preferredRoles: [''],
    preferredLocations: [''],
    preferredWorkModes: this.fb.control<WorkMode[]>([]),
    preferredIndustries: this.fb.control<string[]>([]),
    employmentTypes: this.fb.control<EmploymentType[]>([]),
    noticePeriodDays: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(365)]),
    availability: this.fb.control<Availability | ''>(''),
    openToWork: [true],
    technicalSkills: this.fb.array<SkillForm>([]),
    softSkills: this.fb.array<SkillForm>([]),
    education: this.fb.array<EducationForm>([]),
    experience: this.fb.array<ExperienceForm>([]),
  });

  get technicalSkills(): FormArray<SkillForm> {
    return this.form.controls.technicalSkills;
  }
  get softSkills(): FormArray<SkillForm> {
    return this.form.controls.softSkills;
  }
  get education(): FormArray<EducationForm> {
    return this.form.controls.education;
  }
  get experience(): FormArray<ExperienceForm> {
    return this.form.controls.experience;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .profile()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (p) => this.patch(p),
        error: () => this.loadError.set(true),
      });
  }

  private patch(p: CandidateProfile): void {
    this.profile.set(p);
    this.form.patchValue({
      headline: p.headline ?? '',
      summary: p.summary ?? '',
      location: {
        city: p.location?.city ?? '',
        state: p.location?.state ?? '',
        country: p.location?.country || 'India',
      },
      dateOfBirth: toDateInput(p.dateOfBirth),
      gender: p.gender ?? '',
      careerLevel: p.careerLevel ?? ((p.totalExperienceYears ?? 0) > 0 ? 'experienced' : 'fresher'),
      totalExperienceYears: p.totalExperienceYears ?? 0,
      currentSalary: p.currentSalary ?? null,
      expectedSalary: {
        min: p.expectedSalary?.min ?? null,
        max: p.expectedSalary?.max ?? null,
        period: p.expectedSalary?.period ?? 'yearly',
      },
      preferredRoles: (p.preferredRoles ?? []).join(', '),
      preferredLocations: (p.preferredLocations ?? []).join(', '),
      preferredWorkModes: p.preferredWorkModes ?? [],
      preferredIndustries: p.preferredIndustries ?? [],
      employmentTypes: p.employmentTypes ?? [],
      noticePeriodDays: p.noticePeriodDays ?? null,
      availability: p.availability ?? '',
      openToWork: p.openToWork ?? true,
    });
    this.technicalSkills.clear();
    this.softSkills.clear();
    (p.skills ?? []).forEach((s) => this.addSkill(s.type === 'non_technical' ? 'non_technical' : 'technical', s));
    this.education.clear();
    (p.education ?? []).forEach((e) => this.addEducation(e));
    this.experience.clear();
    (p.experience ?? []).forEach((e) => this.addExperience(e));
    this.form.markAsPristine();
  }

  addSkill(type: SkillType, s?: CandidateSkill): void {
    const target = type === 'technical' ? this.technicalSkills : this.softSkills;
    target.push(
      this.fb.group({
        name: [s?.name ?? '', [Validators.required, Validators.maxLength(60)]],
        type: this.fb.control<SkillType>(type),
        level: this.fb.control<SkillLevel | ''>(s?.level ?? ''),
      }),
    );
  }

  addEducation(e?: CandidateEducation): void {
    this.education.push(
      this.fb.group({
        qualification: [e?.qualification ?? '', [Validators.required, Validators.maxLength(120)]],
        specialization: [e?.specialization ?? '', [Validators.maxLength(120)]],
        institution: [e?.institution ?? '', [Validators.required, Validators.maxLength(160)]],
        startYear: this.fb.control<number | null>(e?.startYear ?? null, [Validators.min(1950), Validators.max(this.maxYear)]),
        endYear: this.fb.control<number | null>(e?.endYear ?? null, [Validators.min(1950), Validators.max(this.maxYear)]),
        grade: [e?.grade ?? '', [Validators.maxLength(40)]],
      }),
    );
  }

  addExperience(e?: CandidateExperience): void {
    const group: ExperienceForm = this.fb.group({
      title: [e?.title ?? '', [Validators.required, Validators.maxLength(120)]],
      company: [e?.company ?? '', [Validators.required, Validators.maxLength(160)]],
      location: [e?.location ?? '', [Validators.maxLength(120)]],
      startDate: [toDateInput(e?.startDate), [Validators.required]],
      endDate: [toDateInput(e?.endDate)],
      current: [e?.current ?? false],
      description: [e?.description ?? '', [Validators.maxLength(2000)]],
    });
    const syncEnd = (current: boolean): void => {
      if (current) {
        group.controls.endDate.setValue('');
        group.controls.endDate.disable({ emitEvent: false });
      } else {
        group.controls.endDate.enable({ emitEvent: false });
      }
    };
    syncEnd(group.controls.current.value);
    group.controls.current.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(syncEnd);
    this.experience.push(group);
  }

  onToggle<T extends string>(control: FormControl<T[]>, value: T, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = control.value;
    control.setValue(checked ? [...new Set([...current, value])] : current.filter((v) => v !== value));
    control.markAsDirty();
  }

  chips(value: string): string[] {
    return csvToList(value);
  }

  remove(array: FormArray, index: number): void {
    array.removeAt(index);
    this.form.markAsDirty();
  }

  /** Tabs containing invalid, touched controls get a warning marker. */
  tabHasError(tab: ProfileTab): boolean {
    const c = this.form.controls;
    const bad = (ctrl: AbstractControl): boolean => ctrl.invalid && (ctrl.touched || ctrl.dirty);
    switch (tab) {
      case 'personal':
        return bad(c.headline) || bad(c.summary) || bad(c.location);
      case 'education':
        return bad(c.education);
      case 'skills':
        return bad(c.technicalSkills) || bad(c.softSkills);
      case 'experience':
        return bad(c.experience) || bad(c.totalExperienceYears);
      case 'preferences':
        return bad(c.expectedSalary) || bad(c.currentSalary) || bad(c.noticePeriodDays);
    }
  }

  private firstInvalidTab(): ProfileTab | null {
    const c = this.form.controls;
    if (c.headline.invalid || c.summary.invalid || c.location.invalid) return 'personal';
    if (c.education.invalid) return 'education';
    if (c.technicalSkills.invalid || c.softSkills.invalid) return 'skills';
    if (c.experience.invalid || c.totalExperienceYears.invalid) return 'experience';
    if (c.expectedSalary.invalid || c.currentSalary.invalid || c.noticePeriodDays.invalid) return 'preferences';
    return null;
  }

  save(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const tab = this.firstInvalidTab();
      if (tab) this.activeTab.set(tab);
      this.formError.set('Please fix the highlighted fields before saving.');
      return;
    }
    const v = this.form.getRawValue();
    const isFresher = v.careerLevel === 'fresher';
    const skills: CandidateSkill[] = [...v.technicalSkills, ...v.softSkills].map((s) => ({
      name: s.name.trim(),
      type: s.type,
      ...(s.level ? { level: s.level } : {}),
    }));
    const body: CandidateProfileInput = {
      headline: v.headline.trim(),
      summary: v.summary.trim(),
      location: { city: v.location.city.trim(), state: v.location.state.trim(), country: v.location.country.trim() || 'India' },
      dateOfBirth: v.dateOfBirth || undefined,
      gender: v.gender || undefined,
      careerLevel: v.careerLevel,
      totalExperienceYears: isFresher ? 0 : (numberOrUndefined(v.totalExperienceYears) ?? 0),
      currentSalary: isFresher ? undefined : numberOrUndefined(v.currentSalary),
      expectedSalary: {
        min: numberOrUndefined(v.expectedSalary.min),
        max: numberOrUndefined(v.expectedSalary.max),
        period: v.expectedSalary.period,
      },
      preferredRoles: csvToList(v.preferredRoles),
      preferredLocations: csvToList(v.preferredLocations),
      preferredWorkModes: v.preferredWorkModes,
      preferredIndustries: v.preferredIndustries,
      employmentTypes: v.employmentTypes,
      noticePeriodDays: numberOrUndefined(v.noticePeriodDays),
      availability: v.availability || undefined,
      openToWork: v.openToWork,
      skills,
      education: v.education.map((e) => ({
        qualification: e.qualification.trim(),
        specialization: emptyToUndefined(e.specialization),
        institution: e.institution.trim(),
        startYear: numberOrUndefined(e.startYear),
        endYear: numberOrUndefined(e.endYear),
        grade: emptyToUndefined(e.grade),
      })),
      experience: v.experience.map((e) => ({
        title: e.title.trim(),
        company: e.company.trim(),
        location: emptyToUndefined(e.location),
        startDate: e.startDate,
        endDate: e.current ? undefined : e.endDate || undefined,
        current: e.current,
        description: emptyToUndefined(e.description),
      })),
    };
    this.saving.set(true);
    this.api
      .updateProfile(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (p) => {
          this.patch(p);
          this.toast.success('Profile saved');
        },
        error: (err: unknown) => {
          const unmatched = applyServerErrors(this.form, toAppError(err));
          if (unmatched.length) {
            this.formError.set(unmatched.join(' '));
          }
        },
      });
  }
}
