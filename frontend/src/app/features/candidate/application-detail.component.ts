import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { CandidateApplication } from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../shared/pipes/location.pipe';
import { WITHDRAWABLE, applicationCompany } from './applications.component';
import { HistoryTimelineComponent } from './history-timeline.component';

/**
 * Application detail. The contract has no GET /candidates/me/applications/:id, so the item is
 * looked up from the candidate's application list (first 100).
 */
@Component({
  selector: 'app-candidate-application-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe, LocationsPipe, HistoryTimelineComponent],
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a routerLink="/candidate/applications">My applications</a></li>
        <li class="breadcrumb-item active" aria-current="page">Application</li>
      </ol>
    </nav>
    @if (app.isLoading()) {
      <app-skeleton variant="card" [count]="2" />
    } @else if (app.error()) {
      <app-empty-state tone="error" illustration="error" title="We couldn't load this application">
        <button class="btn btn-primary" type="button" (click)="app.reload()">Retry</button>
      </app-empty-state>
    } @else if (current(); as a) {
      <div class="layout">
        <div class="d-flex flex-column gap-4 min-w-0">
          <section class="card head">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
                <div class="min-w-0">
                  <h1 class="h3 mb-1 title">{{ a.job.title }}</h1>
                  <p class="text-secondary mb-0">
                    <i class="bi bi-buildings" aria-hidden="true"></i> {{ company(a) }}
                    @if (a.job.locations?.length) { · {{ a.job.locations | locations: 2 }} }
                    @if (a.job.employmentType) { · {{ a.job.employmentType | enumLabel }} }
                  </p>
                </div>
                <app-status-chip [status]="a.status" />
              </div>
              <div class="d-flex flex-wrap gap-2 mt-3">
                @if (a.job.slug) {
                  <a class="btn btn-outline-primary" [routerLink]="['/jobs', a.job.slug]"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> View job</a>
                }
                @if (canWithdraw()) {
                  <button class="btn btn-outline-danger" type="button" (click)="withdraw(a)" [disabled]="busy()" data-testid="withdraw">
                    <i class="bi bi-x-circle" aria-hidden="true"></i> Withdraw application
                  </button>
                }
              </div>
            </div>
          </section>
          <section class="card">
            <div class="card-body">
              <h2 class="h6"><i class="bi bi-info-circle text-gold" aria-hidden="true"></i> What happens next</h2>
              <p class="small text-secondary mb-0">
                A Veejee Services recruiter reviews your application against the client's requirement. If you're shortlisted and have
                consented to profile sharing, we submit your profile to the company and keep you updated here and by email.
              </p>
            </div>
          </section>
          @if (a.coverLetter) {
            <section class="card">
              <div class="card-body">
                <h2 class="h6">Cover letter</h2>
                <p class="prose mb-0">{{ a.coverLetter }}</p>
              </div>
            </section>
          }
        </div>
        <aside class="d-flex flex-column gap-4">
          <section class="card">
            <div class="card-body">
              <h2 class="h6 mb-3"><i class="bi bi-clock-history text-gold" aria-hidden="true"></i> Status history</h2>
              <app-history-timeline [history]="a.statusHistory" />
            </div>
          </section>
          <section class="card">
            <div class="card-body small">
              <p class="mb-1"><strong>Applied:</strong> {{ a.createdAt | date: 'medium' }}</p>
              <p class="mb-0"><strong>Resume:</strong> {{ resumeName(a) }}</p>
            </div>
          </section>
        </aside>
      </div>
    } @else {
      <app-empty-state illustration="not-found" title="Application not found" message="It may have been removed.">
        <a class="btn btn-primary" routerLink="/candidate/applications">Back to my applications</a>
      </app-empty-state>
    }
  `,
  styles: `
    .layout { display: grid; gap: var(--an-space-4); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 992px) { .layout { grid-template-columns: minmax(0, 1fr) 340px; align-items: start; } }
    .head { border-top: 4px solid var(--an-gold-500); }
    .title { overflow-wrap: anywhere; }
    .min-w-0 { min-width: 0; }
  `,
})
export default class CandidateApplicationDetailComponent {
  readonly id = input.required<string>();
  private readonly api = inject(CandidateService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  private readonly override = signal<CandidateApplication | null>(null);
  protected readonly app = rxResource({
    params: () => this.id(),
    stream: ({ params }) =>
      this.api.applications({ limit: 100 }).pipe(map((p) => p.items.find((a) => a.id === params) ?? null)),
  });
  protected readonly current = computed(() => this.override() ?? this.app.value() ?? null);
  protected readonly canWithdraw = computed(() => {
    const a = this.current();
    return !!a && WITHDRAWABLE.includes(a.status);
  });
  protected company = applicationCompany;

  resumeName(a: CandidateApplication): string {
    const r = a.resume;
    return r && typeof r === 'object' ? r.originalName : 'Primary resume';
  }

  withdraw(a: CandidateApplication): void {
    this.confirm
      .open({
        title: 'Withdraw this application?',
        message: `Veejee Services will stop considering you for “${a.job.title}”. This cannot be undone.`,
        confirmText: 'Withdraw application',
        tone: 'danger',
        reason: { label: 'Reason (optional)', maxLength: 500 },
      })
      .subscribe((res) => {
        if (!res) return;
        this.busy.set(true);
        this.api
          .withdraw(a.id, res.reason)
          .pipe(finalize(() => this.busy.set(false)))
          .subscribe((updated) => {
            this.override.set({ ...a, ...updated, job: a.job, status: 'withdrawn' });
            this.toast.success('Application withdrawn');
          });
      });
  }
}
