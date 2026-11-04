import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { SystemSettings } from '../../core/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

type WeightKey = keyof SystemSettings['matchingWeights'];

const WEIGHTS: { key: WeightKey; label: string; icon: string; hint: string }[] = [
  { key: 'skills', label: 'Skills', icon: 'bi-tools', hint: 'Required skills the candidate has' },
  { key: 'experience', label: 'Experience', icon: 'bi-briefcase', hint: 'Years of experience within the requested range' },
  { key: 'education', label: 'Education', icon: 'bi-mortarboard', hint: 'Qualifications and specialization' },
  { key: 'location', label: 'Location', icon: 'bi-geo-alt', hint: 'Current or preferred location' },
  { key: 'salary', label: 'Salary', icon: 'bi-cash-stack', hint: 'Expected salary within budget' },
  { key: 'noticePeriod', label: 'Notice period', icon: 'bi-hourglass-split', hint: 'Notice period within the limit' },
];

@Component({
  selector: 'app-admin-system-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, EmptyStateComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-page-header eyebrow="Configuration" title="System settings" subtitle="Candidate matching, shortlist approval, reminders and email notifications." illustration="settings" />

    @if (loading()) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (loadError(); as err) {
      <app-empty-state tone="error" title="Couldn't load settings" [message]="err">
        <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
      </app-empty-state>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="d-grid gap-4">
        <section class="card" formGroupName="matchingWeights" aria-labelledby="w-h">
          <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h2 id="w-h" class="h6 m-0"><i class="bi bi-sliders text-gold" aria-hidden="true"></i> Candidate matching weights</h2>
            <span class="badge" [class]="total() === 100 ? 'badge text-bg-success' : 'badge text-bg-warning'" data-testid="weights-total">Total {{ total() }}%</span>
          </div>
          <div class="card-body">
            <p class="small text-secondary">How much each factor contributes to the match score recruiters see for a requirement. Scores rank candidates only — they never reject anyone automatically. Weights are normalised by the server; a total of 100 is easiest to read.</p>
            <div class="weights">
              @for (w of weights; track w.key) {
                <div class="w">
                  <div class="d-flex justify-content-between align-items-center gap-2">
                    <label class="form-label m-0" [for]="'w-' + w.key"><i [class]="'bi ' + w.icon + ' text-gold'" aria-hidden="true"></i> {{ w.label }}</label>
                    <span class="fw-bold">{{ weightValue(w.key) }}</span>
                  </div>
                  <input type="range" class="form-range" min="0" max="100" step="1" [id]="'w-' + w.key" [formControlName]="w.key"
                    [attr.aria-describedby]="'w-' + w.key + '-hint'" />
                  <div class="share" aria-hidden="true"><span [style.width.%]="share(w.key)"></span></div>
                  <div class="form-text" [id]="'w-' + w.key + '-hint'">{{ w.hint }} · {{ share(w.key) }}% of the score</div>
                </div>
              }
            </div>
            @if (total() === 0) {
              <div class="alert alert-warning mt-3 mb-0" role="alert"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> At least one weight must be above zero.</div>
            }
          </div>
        </section>

        <section class="card" aria-labelledby="sa-h">
          <div class="card-header"><h2 id="sa-h" class="h6 m-0"><i class="bi bi-patch-check text-gold" aria-hidden="true"></i> Shortlist approval</h2></div>
          <div class="card-body">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="s-approval" formControlName="requireShortlistApproval" />
              <label class="form-check-label" for="s-approval">Require admin approval before a shortlisted candidate can be submitted to a company</label>
            </div>
            <div class="form-text">Admins holding “Approve shortlists” review new shortlists in Shortlist approvals.</div>
          </div>
        </section>

        <section class="card" formGroupName="reminders" aria-labelledby="r-h">
          <div class="card-header"><h2 id="r-h" class="h6 m-0"><i class="bi bi-alarm text-gold" aria-hidden="true"></i> Reminders</h2></div>
          <div class="card-body">
            <div class="row g-3 align-items-start">
              <div class="col-12 col-md-6">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" role="switch" id="r-profile" formControlName="profileCompletion" />
                  <label class="form-check-label" for="r-profile">Remind candidates to complete their profile</label>
                </div>
                <div class="form-floating mt-2">
                  <input class="form-control" type="number" min="1" max="90" id="r-days" formControlName="profileReminderDays" placeholder=" " />
                  <label for="r-days">Days after registration</label>
                </div>
                <app-field-error [control]="form.controls.reminders.controls.profileReminderDays" label="Days" />
              </div>
              <div class="col-12 col-md-6">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" role="switch" id="r-interview" formControlName="interview" />
                  <label class="form-check-label" for="r-interview">Send interview reminders</label>
                </div>
                <div class="form-floating mt-2">
                  <input class="form-control" type="number" min="1" max="168" id="r-hours" formControlName="interviewHoursBefore" placeholder=" " />
                  <label for="r-hours">Hours before the interview</label>
                </div>
                <app-field-error [control]="form.controls.reminders.controls.interviewHoursBefore" label="Hours" />
              </div>
            </div>
          </div>
        </section>

        <section class="card" formGroupName="notifications" aria-labelledby="n-h">
          <div class="card-header"><h2 id="n-h" class="h6 m-0"><i class="bi bi-envelope-paper text-gold" aria-hidden="true"></i> Email notifications</h2></div>
          <div class="card-body d-grid gap-2">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="n-stage" formControlName="emailCandidatesOnStageChange" />
              <label class="form-check-label" for="n-stage">Email candidates when their recruitment stage changes</label>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="n-sub" formControlName="emailEmployerOnSubmission" />
              <label class="form-check-label" for="n-sub">Email companies when Veejee Services submits a candidate</label>
            </div>
          </div>
        </section>

        <div class="save-bar">
          <button class="btn btn-outline-secondary" type="button" (click)="reset()" [disabled]="saving() || form.pristine">Discard changes</button>
          <button class="btn btn-primary" type="submit" [disabled]="saving() || total() === 0" data-testid="settings-save">
            @if (saving()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> } @else { <i class="bi bi-check2" aria-hidden="true"></i> }
            Save settings
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    .weights { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
    .w { min-width: 0; }
    .share { height: 6px; background: var(--an-surface-2); border-radius: 999px; overflow: hidden; }
    .share span { display: block; height: 100%; background: var(--an-gold-500); border-radius: 999px; transition: width 200ms var(--an-ease); }
    .save-bar { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--an-space-2);
      padding: var(--an-space-3); background: rgba(255, 255, 255, 0.95); border: 1px solid var(--an-border); border-radius: var(--an-radius-lg);
      box-shadow: var(--an-shadow-2); }
  `,
})
export default class AdminSystemSettingsComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly weights = WEIGHTS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  private loaded: SystemSettings | null = null;

  protected readonly form = this.fb.group({
    matchingWeights: this.fb.group({
      skills: 40,
      experience: 20,
      education: 10,
      location: 15,
      salary: 10,
      noticePeriod: 5,
    }),
    requireShortlistApproval: true,
    reminders: this.fb.group({
      profileCompletion: true,
      profileReminderDays: [3, [Validators.required, Validators.min(1), Validators.max(90)]],
      interview: true,
      interviewHoursBefore: [24, [Validators.required, Validators.min(1), Validators.max(168)]],
    }),
    notifications: this.fb.group({
      emailCandidatesOnStageChange: true,
      emailEmployerOnSubmission: true,
    }),
  });

  private readonly weightValues = toSignal(this.form.controls.matchingWeights.valueChanges, {
    initialValue: this.form.controls.matchingWeights.getRawValue(),
  });
  protected readonly total = computed(() =>
    Object.values(this.weightValues()).reduce((sum: number, v) => sum + (Number(v) || 0), 0),
  );

  constructor() {
    this.load();
  }

  protected weightValue(key: WeightKey): number {
    return Number(this.weightValues()[key] ?? 0) || 0;
  }

  protected share(key: WeightKey): number {
    const t = this.total();
    return t > 0 ? Math.round((this.weightValue(key) / t) * 100) : 0;
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.admin
      .settings()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (s) => {
          this.loaded = s;
          this.apply(s);
        },
        error: (e: unknown) => this.loadError.set(friendlyMessage(toAppError(e))),
      });
  }

  reset(): void {
    if (this.loaded) this.apply(this.loaded);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: Partial<SystemSettings> = {
      matchingWeights: {
        skills: Number(v.matchingWeights.skills),
        experience: Number(v.matchingWeights.experience),
        education: Number(v.matchingWeights.education),
        location: Number(v.matchingWeights.location),
        salary: Number(v.matchingWeights.salary),
        noticePeriod: Number(v.matchingWeights.noticePeriod),
      },
      requireShortlistApproval: v.requireShortlistApproval,
      reminders: {
        profileCompletion: v.reminders.profileCompletion,
        profileReminderDays: Number(v.reminders.profileReminderDays),
        interview: v.reminders.interview,
        interviewHoursBefore: Number(v.reminders.interviewHoursBefore),
      },
      notifications: { ...v.notifications },
    };
    this.saving.set(true);
    this.admin
      .updateSettings(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((s) => {
        this.loaded = s && s.matchingWeights ? s : { ...(this.loaded as SystemSettings), ...(body as SystemSettings) };
        this.apply(this.loaded);
        this.toast.success('Settings saved');
      });
  }

  private apply(s: SystemSettings): void {
    this.form.reset({
      matchingWeights: { ...this.form.controls.matchingWeights.getRawValue(), ...s.matchingWeights },
      requireShortlistApproval: s.requireShortlistApproval,
      reminders: { ...this.form.controls.reminders.getRawValue(), ...s.reminders },
      notifications: { ...this.form.controls.notifications.getRawValue(), ...s.notifications },
    });
  }
}
