import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RecruitmentService } from '../../core/services/recruitment.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { CandidateProfile, PersonRef, Ref, SHORTLIST_STATUSES, Shortlist, ShortlistStatus } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ScoreRingComponent } from './admin-widgets';
import { ADMIN_LIST_STYLES, PagedList, intParam, oneOf, updateQuery } from './admin-shared';

@Component({
  selector: 'app-admin-shortlists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginatorComponent,
    SkeletonComponent,
    StatusChipComponent,
    EnumLabelPipe,
    TimeAgoPipe,
    ScoreRingComponent,
  ],
  template: `
    <app-page-header
      eyebrow="Quality control"
      title="Shortlist approvals"
      subtitle="Review candidates shortlisted by recruiters before they can be submitted to client companies. Matching scores are guidance only."
      illustration="moderation"
    />

    <ul class="nav nav-pills nav-scroll mb-3" role="tablist" aria-label="Filter shortlists by status">
      @for (t of tabs; track t.value) {
        <li class="nav-item" role="presentation">
          <button class="nav-link" type="button" role="tab" [class.active]="status() === t.value" [attr.aria-selected]="status() === t.value"
            (click)="setStatus(t.value)">{{ t.label }}</button>
        </li>
      }
    </ul>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" title="Couldn't load shortlists" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state
        [illustration]="status() === 'pending_approval' ? 'success' : 'empty-candidates'"
        [title]="status() === 'pending_approval' ? 'All caught up' : 'No shortlists here'"
        [message]="status() === 'pending_approval' ? 'No shortlists are waiting for approval.' : 'Nothing matches this filter.'"
      />
    } @else {
      <p class="count">{{ list.total() }} shortlist{{ list.total() === 1 ? '' : 's' }}</p>
      <div class="d-grid gap-3">
        @for (s of list.items(); track s.id) {
          <article class="card sl" [class.pending]="s.status === 'pending_approval'" data-testid="shortlist-row" [attr.data-shortlist-id]="s.id">
            <div class="card-body">
              <div class="d-flex flex-wrap gap-3 align-items-start">
                @if (s.match) {
                  <app-score-ring [score]="s.match.score" [size]="56" />
                }
                <div class="min-w-0 flex-grow-1">
                  <div class="d-flex flex-wrap align-items-center gap-2">
                    @if (canOpenCandidate()) {
                      <a class="cell-main fs-6" [routerLink]="['/recruiter/candidates', candidateId(s)]">{{ personName(s.candidate) }}</a>
                    } @else {
                      <span class="cell-main fs-6">{{ personName(s.candidate) }}</span>
                    }
                    <app-status-chip [status]="s.status" />
                  </div>
                  @if (profile(s); as p) {
                    <div class="cell-sub">
                      {{ p.headline || 'Candidate' }}
                      @if (p.totalExperienceYears !== undefined) { · {{ p.totalExperienceYears }} yrs }
                      @if (p.careerLevel) { · {{ p.careerLevel | enumLabel }} }
                    </div>
                  }
                  <div class="cell-sub mt-1">
                    <i class="bi bi-clipboard-check" aria-hidden="true"></i> {{ s.job.title }}
                    · <i class="bi bi-building" aria-hidden="true"></i> {{ s.job.companyName || 'Confidential client' }}
                  </div>
                  <div class="cell-sub">
                    Shortlisted by {{ personName(s.shortlistedBy) }} · <time [attr.datetime]="s.createdAt" [title]="s.createdAt | date: 'medium'">{{ s.createdAt | timeAgo }}</time>
                    @if (s.source) { · via {{ s.source | enumLabel }} }
                  </div>
                  @if (profile(s)?.consent; as c) {
                    <div class="d-flex flex-wrap gap-1 mt-2">
                      <span class="badge" [class]="c.profileSharing ? 'badge text-bg-success' : 'badge text-bg-warning'">
                        <i [class]="c.profileSharing ? 'bi bi-shield-check' : 'bi bi-shield-exclamation'" aria-hidden="true"></i>
                        {{ c.profileSharing ? 'Profile sharing consent' : 'No profile sharing consent' }}
                      </span>
                      <span class="badge text-bg-light border">
                        <i [class]="c.contactSharing ? 'bi bi-telephone' : 'bi bi-telephone-x'" aria-hidden="true"></i>
                        {{ c.contactSharing ? 'Contact sharing allowed' : 'Contact not shareable' }}
                      </span>
                    </div>
                  }
                  @if (s.note) {
                    <p class="note mb-0 mt-2"><i class="bi bi-chat-left-text" aria-hidden="true"></i> {{ s.note }}</p>
                  }
                  @if (s.reviewNote) {
                    <p class="note mb-0 mt-2"><i class="bi bi-person-check" aria-hidden="true"></i> Review: {{ s.reviewNote }}</p>
                  }
                </div>
                @if (s.status === 'pending_approval') {
                  <div class="actions d-flex flex-wrap gap-2">
                    <button class="btn btn-success" type="button" [disabled]="busy() === s.id" (click)="approve(s)">Approve</button>
                    <button class="btn btn-outline-danger" type="button" [disabled]="busy() === s.id" (click)="reject(s)">Reject</button>
                  </div>
                }
              </div>
              @if (s.match?.factors?.length) {
                <button class="btn btn-link btn-sm px-0 mt-2" type="button" (click)="toggle(s.id)" [attr.aria-expanded]="open() === s.id"
                  [attr.aria-controls]="'factors-' + s.id">
                  <i [class]="open() === s.id ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" aria-hidden="true"></i> Match breakdown
                </button>
                @if (open() === s.id) {
                  <ul class="factors" [id]="'factors-' + s.id">
                    @for (f of factors(s); track f.key) {
                      <li>
                        <div class="d-flex justify-content-between gap-2 small">
                          <span class="fw-semibold">{{ f.label }} <span class="text-secondary fw-normal">({{ f.weight }}%)</span></span>
                          <span>{{ pct(f.score) }}%</span>
                        </div>
                        <div class="progress" role="progressbar" [attr.aria-valuenow]="pct(f.score)" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="f.label">
                          <div class="progress-bar" [style.width.%]="pct(f.score)"></div>
                        </div>
                        <div class="small text-secondary">{{ f.reason }}</div>
                      </li>
                    }
                  </ul>
                }
              }
            </div>
          </article>
        }
      </div>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .min-w-0 { min-width: 0; }
      .sl.pending { border-left: 4px solid var(--an-gold-500); }
      .actions { flex: 0 0 auto; }
      .note { font-size: 0.86rem; color: var(--an-text-2); background: var(--an-surface-2); border-radius: var(--an-radius-sm); padding: 6px 10px; }
      .factors { list-style: none; padding: 0; margin: var(--an-space-2) 0 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
      .factors .progress { margin: 4px 0; }
      @media (max-width: 575.98px) { .actions { width: 100%; } .actions .btn { flex: 1 1 0; } }
    `,
  ],
})
export default class AdminShortlistsComponent {
  private readonly recruitment = inject(RecruitmentService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs: { value: ShortlistStatus | 'all'; label: string }[] = [
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'removed', label: 'Removed' },
    { value: 'all', label: 'All' },
  ];
  protected readonly list = new PagedList<Shortlist>();
  protected readonly busy = signal<string | null>(null);
  protected readonly open = signal<string | null>(null);
  protected readonly canOpenCandidate = computed(() => this.auth.canRecruit());

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly status = computed<ShortlistStatus | 'all'>(() => {
    const raw = this.params().get('status');
    if (raw === 'all') return 'all';
    return oneOf(raw, SHORTLIST_STATUSES) ?? 'pending_approval';
  });
  private readonly query = computed(() => ({
    status: this.status() === 'all' ? undefined : (this.status() as ShortlistStatus),
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.recruitment.shortlists(q)));
    });
  }

  reload(): void {
    this.list.load(this.recruitment.shortlists(this.query()));
  }

  setStatus(value: string): void {
    updateQuery(this.router, this.route, { status: value === 'pending_approval' ? null : value });
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  toggle(id: string): void {
    this.open.set(this.open() === id ? null : id);
  }

  protected factors(s: Shortlist): NonNullable<Shortlist['match']>['factors'] {
    return s.match?.factors ?? [];
  }

  protected pct(score: number): number {
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  }

  protected personName(p: Ref<PersonRef> | null | undefined): string {
    if (!p) return '—';
    return typeof p === 'string' ? 'Recruiter' : p.name;
  }

  protected candidateId(s: Shortlist): string {
    const p = s.candidateProfile;
    if (p && typeof p !== 'string' && p.id) return p.id;
    return typeof p === 'string' ? p : '';
  }

  protected profile(s: Shortlist): Partial<CandidateProfile> | null {
    return s.candidateProfile && typeof s.candidateProfile !== 'string' ? s.candidateProfile : null;
  }

  approve(s: Shortlist): void {
    this.confirm
      .open({
        title: `Approve ${this.personName(s.candidate)}?`,
        message: `The recruiter can then submit this candidate to ${s.job.companyName || 'the client'} for “${s.job.title}”, subject to the candidate's consent.`,
        confirmText: 'Approve',
        reason: { label: 'Note for the recruiter (optional)', required: false },
      })
      .subscribe((r) => {
        if (!r) return;
        this.decide(s, 'approve', r.reason);
      });
  }

  reject(s: Shortlist): void {
    this.confirm
      .open({
        title: `Reject ${this.personName(s.candidate)}?`,
        message: 'The recruiter will see your reason. The candidate is not notified.',
        confirmText: 'Reject',
        tone: 'danger',
        reason: { label: 'Reason', required: true },
      })
      .subscribe((r) => {
        if (!r) return;
        this.decide(s, 'reject', r.reason);
      });
  }

  private decide(s: Shortlist, decision: 'approve' | 'reject', note: string): void {
    this.busy.set(s.id);
    this.recruitment
      .reviewShortlist(s.id, decision, note)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe(() => {
        const next: ShortlistStatus = decision === 'approve' ? 'approved' : 'rejected';
        if (this.status() !== 'all' && this.status() !== next) {
          this.list.remove(s.id);
        } else {
          this.list.patch(s.id, { status: next, reviewNote: note || undefined });
        }
        this.toast.success(decision === 'approve' ? 'Shortlist approved' : 'Shortlist rejected');
      });
  }
}
