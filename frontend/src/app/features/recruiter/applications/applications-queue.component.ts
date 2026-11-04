import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { CANDIDATE_APPLICATION_STATUSES, CandidateApplication, Requirement } from '../../../core/models';
import { ConfirmService } from '../../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../../shared/components/paginator.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { numParam, refId, refName } from '../candidates/recruiter-utils';

const STATUS_FILTERS = ['applied', 'under_review', 'shortlisted', 'not_shortlisted', 'withdrawn'] as const;

@Component({
  selector: 'app-applications-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginatorComponent,
    SkeletonComponent,
    StageBadgeComponent,
    StatusChipComponent,
    EnumLabelPipe,
    TimeAgoPipe,
  ],
  template: `
    <app-page-header eyebrow="Recruiter portal" title="Applications" illustration="applications"
      subtitle="Candidates who applied to requirements through Veejee Services. Screen them and shortlist the strongest profiles." />

    <div class="card mb-3">
      <div class="card-body d-flex flex-wrap gap-3 align-items-center">
        <ul class="nav nav-pills nav-scroll flex-grow-1" aria-label="Filter by status">
          <li class="nav-item">
            <button class="nav-link" type="button" [class.active]="!status()" (click)="setStatus(null)">All</button>
          </li>
          @for (s of statuses; track s) {
            <li class="nav-item">
              <button class="nav-link" type="button" [class.active]="status() === s" [attr.aria-pressed]="status() === s" (click)="setStatus(s)">{{ s | enumLabel }}</button>
            </li>
          }
        </ul>
        <div class="form-floating req-filter">
          <select class="form-select" id="aq-job" (change)="setJob($event)">
            <option value="" [selected]="!jobId()">All requirements</option>
            @for (r of requirements(); track r.id) {
              <option [value]="r.id" [selected]="r.id === jobId()">{{ r.title }} – {{ r.companyName || 'Client' }}</option>
            }
          </select>
          <label for="aq-job">Requirement</label>
        </div>
      </div>
    </div>

    @if (list.isLoading()) {
      <app-skeleton variant="table" [count]="6" />
    } @else if (list.error()) {
      <app-empty-state tone="error" title="Applications could not be loaded">
        <button class="btn btn-primary" type="button" (click)="list.reload()">Retry</button>
      </app-empty-state>
    } @else if (list.value(); as res) {
      <ul class="apps">
        @for (a of res.items; track a.id) {
          <li class="card card-hover app" data-testid="application-row">
            <div class="card-body">
              <div class="top">
                <div class="min-w-0 flex-grow-1">
                  <a class="fw-semibold fs-6" [routerLink]="['/recruiter/candidates', candidateId(a)]">{{ personName(a.candidate) }}</a>
                  <span class="d-block small text-secondary">{{ headline(a) }}</span>
                </div>
                <app-status-chip [status]="a.status" />
              </div>
              <div class="meta">
                <span><i class="bi bi-clipboard-check" aria-hidden="true"></i>{{ a.job.title }} · {{ a.job.companyName || 'Client company' }}</span>
                <span><i class="bi bi-clock" aria-hidden="true"></i>Applied {{ a.createdAt | timeAgo }}</span>
                @if (resumeName(a); as rn) { <span><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>{{ rn }}</span> }
                @if (stageOf(a); as st) { <app-stage-badge [stage]="st" /> }
              </div>
              <div class="actions">
                @if (a.status === 'applied') {
                  <button class="btn btn-sm btn-outline-primary" type="button" [disabled]="busy() === a.id" (click)="review(a)">
                    <i class="bi bi-eye" aria-hidden="true"></i> Mark under review</button>
                }
                @if (a.status === 'applied' || a.status === 'under_review') {
                  <button class="btn btn-sm btn-gold" type="button" [disabled]="busy() === a.id" (click)="shortlist(a)">
                    <i class="bi bi-star" aria-hidden="true"></i> Shortlist</button>
                  <button class="btn btn-sm btn-outline-danger" type="button" [disabled]="busy() === a.id" (click)="reject(a)">
                    <i class="bi bi-x-circle" aria-hidden="true"></i> Not shortlisted</button>
                }
                <a class="btn btn-sm btn-link" [routerLink]="['/recruiter/candidates', candidateId(a)]">Review profile</a>
              </div>
            </div>
          </li>
        } @empty {
          <li><app-empty-state illustration="empty-applications" title="No applications here" message="New applications appear when candidates apply through Veejee Services." /></li>
        }
      </ul>
      <app-paginator [page]="res.page" [limit]="res.limit" [total]="res.total" (pageChange)="onPage($event)" />
    }
  `,
  styles: `
    .req-filter { min-width: 240px; flex: 1 1 240px; max-width: 420px; }
    .apps { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--an-space-3); }
    .top { display: flex; gap: var(--an-space-3); align-items: flex-start; }
    .min-w-0 { min-width: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; margin: var(--an-space-2) 0; font-size: 0.86rem; color: var(--an-text-2); }
    .meta span { display: inline-flex; gap: 6px; align-items: center; min-width: 0; overflow-wrap: anywhere; }
    .meta .bi { color: var(--an-gold-600); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--an-space-2); justify-content: flex-end; }
  `,
})
export default class ApplicationsQueueComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RecruitmentService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly statuses = STATUS_FILTERS;
  protected readonly busy = signal<string | null>(null);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly status = computed(() => {
    const s = this.params().get('status');
    return s && (CANDIDATE_APPLICATION_STATUSES as readonly string[]).includes(s) ? s : null;
  });
  protected readonly jobId = computed(() => this.params().get('jobId') || null);
  private readonly page = computed(() => numParam(this.params().get('page')) ?? 1);

  protected readonly list = rxResource({
    params: () => ({ status: this.status() ?? undefined, jobId: this.jobId() ?? undefined, page: this.page(), limit: 20 }),
    stream: ({ params }) => this.api.applications(params),
  });
  protected readonly requirements = toSignal(
    this.api.requirements({ status: 'published', limit: 100 }).pipe(
      map((p) => p.items),
      catchError(() => of<Requirement[]>([])),
    ),
    { initialValue: [] as Requirement[] },
  );

  protected readonly personName = refName;

  protected candidateId(a: CandidateApplication): string {
    return refId(a.candidateProfile ?? null);
  }

  protected headline(a: CandidateApplication): string {
    const p = a.candidateProfile;
    if (!p || typeof p === 'string') return '';
    return [p.headline, p.totalExperienceYears !== undefined ? `${p.totalExperienceYears} yrs` : ''].filter(Boolean).join(' · ');
  }

  protected stageOf(a: CandidateApplication): string | null {
    const p = a.candidateProfile;
    return p && typeof p !== 'string' ? (p.stage ?? null) : null;
  }

  protected resumeName(a: CandidateApplication): string {
    const r = a.resume;
    return r && typeof r !== 'string' ? r.originalName : '';
  }

  setStatus(s: string | null): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { status: s, page: null }, queryParamsHandling: 'merge' });
  }

  setJob(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { jobId: v || null, page: null }, queryParamsHandling: 'merge' });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: e.page > 1 ? e.page : null }, queryParamsHandling: 'merge' });
  }

  review(a: CandidateApplication): void {
    this.busy.set(a.id);
    this.api
      .updateApplication(a.id, 'under_review')
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe(() => {
        this.toast.success('Application marked as under review');
        this.list.reload();
      });
  }

  reject(a: CandidateApplication): void {
    this.confirm
      .open({
        title: 'Mark as not shortlisted?',
        message: `${refName(a.candidate)} will not be considered for ${a.job.title}. The candidate stays in the Veejee Services database for other requirements.`,
        confirmText: 'Not shortlisted',
        tone: 'danger',
        reason: { label: 'Note (optional)', maxLength: 2000 },
      })
      .subscribe((r) => {
        if (!r) return;
        this.busy.set(a.id);
        this.api
          .updateApplication(a.id, 'not_shortlisted', r.reason)
          .pipe(finalize(() => this.busy.set(null)))
          .subscribe(() => {
            this.toast.success('Application updated');
            this.list.reload();
          });
      });
  }

  shortlist(a: CandidateApplication): void {
    this.confirm
      .open({
        title: 'Shortlist this candidate?',
        message: `Shortlist ${refName(a.candidate)} for ${a.job.title}. Shortlists may need management approval before submission to the company.`,
        confirmText: 'Shortlist',
        reason: { label: 'Note (optional)', maxLength: 2000 },
      })
      .subscribe((r) => {
        if (!r) return;
        this.busy.set(a.id);
        this.api
          .shortlist({ jobId: a.job.id, candidateId: this.candidateId(a), applicationId: a.id, note: r.reason || undefined, source: 'application' })
          .pipe(finalize(() => this.busy.set(null)))
          .subscribe((s) => {
            this.toast.success(s.status === 'pending_approval' ? 'Candidate shortlisted – awaiting approval' : 'Candidate shortlisted');
            this.list.reload();
          });
      });
  }
}
