import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { CandidateProfile, Shortlist, Submission } from '../../../core/models';
import { ConfirmService } from '../../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { ModalService } from '../../../shared/ui/modal.service';
import { MatchRingComponent } from '../shared/match-ring.component';
import { refId, refName, refObj } from '../shared/recruiter-utils';
import { SubmitDialogComponent, SubmitDialogData } from '../shared/submit-dialog.component';

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  removed: 'Removed',
  submitted: 'Submitted',
};

/** Shortlisted candidates for one requirement: remove, or submit approved ones to the company. */
@Component({
  selector: 'app-shortlist-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe, MatchRingComponent],
  template: `
    @if (list.isLoading()) {
      <app-skeleton variant="lines" [count]="4" />
    } @else if (list.error()) {
      <app-empty-state tone="error" title="Shortlist could not be loaded">
        <button class="btn btn-primary" type="button" (click)="list.reload()">Retry</button>
      </app-empty-state>
    } @else {
      <ul class="list-unstyled d-grid gap-3 m-0">
        @for (s of list.value()?.items ?? []; track s.id) {
          <li class="card sl" data-testid="shortlist-item" [class.muted-card]="s.status === 'removed' || s.status === 'rejected'">
            <div class="card-body d-flex flex-wrap gap-3 align-items-start">
              @if (s.match; as mt) {
                <app-match-ring [score]="mt.score" [size]="52" />
              }
              <div class="grow">
                <h3 class="h6 mb-1">
                  @if (profileId(s); as pid) {
                    <a [routerLink]="['/recruiter/candidates', pid]">{{ name(s) }}</a>
                  } @else {
                    {{ name(s) }}
                  }
                </h3>
                <p class="small text-secondary mb-2">
                  {{ profile(s)?.headline || '' }}
                  @if (profile(s)?.totalExperienceYears !== undefined) { · {{ profile(s)?.totalExperienceYears }} yrs }
                  · shortlisted by {{ by(s) }} on {{ s.createdAt | date: 'mediumDate' }}
                  @if (s.source) { · via {{ s.source | enumLabel }} }
                </p>
                <div class="d-flex flex-wrap gap-2">
                  <app-status-chip [status]="s.status" [label]="label(s.status)" />
                  <span class="badge" [class]="consent(s) ? 'badge text-bg-success' : 'badge text-bg-secondary'">
                    <i [class]="consent(s) ? 'bi bi-shield-check' : 'bi bi-shield-x'" aria-hidden="true"></i>
                    {{ consent(s) ? 'Profile sharing consented' : 'No profile-sharing consent' }}
                  </span>
                </div>
                @if (s.status === 'pending_approval') {
                  <p class="small text-secondary mb-0 mt-2"><i class="bi bi-hourglass-split" aria-hidden="true"></i> Waiting for admin approval before it can be submitted.</p>
                }
                @if (s.status === 'rejected' && s.reviewNote) {
                  <p class="small text-danger mb-0 mt-2"><i class="bi bi-x-circle" aria-hidden="true"></i> {{ s.reviewNote }}</p>
                }
              </div>
              <div class="d-flex flex-wrap gap-2">
                @if (s.status === 'approved') {
                  <button type="button" class="btn btn-gold" (click)="submit(s)"><i class="bi bi-send-check" aria-hidden="true"></i> Submit to company</button>
                }
                @if (s.status === 'pending_approval' || s.status === 'approved') {
                  <button type="button" class="btn btn-outline-danger" (click)="remove(s)"><i class="bi bi-trash" aria-hidden="true"></i> Remove</button>
                }
              </div>
            </div>
          </li>
        } @empty {
          <li><app-empty-state illustration="empty-candidates" title="No one shortlisted yet" message="Use Candidate matching or the Applicants tab to shortlist candidates for this requirement." /></li>
        }
      </ul>
    }
  `,
  styles: `
    .sl { border-left: 4px solid var(--an-gold-500); }
    .muted-card { opacity: 0.75; border-left-color: var(--an-border-strong); }
    .grow { flex: 1 1 240px; min-width: 0; }
    h3 a { color: var(--an-navy-900); text-decoration: none; }
    h3 a:hover { text-decoration: underline; }
  `,
})
export class ShortlistTabComponent {
  readonly requirementId = input.required<string>();
  readonly companyName = input<string>();
  /** Bump to reload (e.g. after shortlisting from another tab). */
  readonly version = input(0);
  readonly changed = output<Submission | Shortlist>();

  private readonly api = inject(RecruitmentService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly list = rxResource({
    params: () => ({ jobId: this.requirementId(), v: this.version() }),
    stream: ({ params }) => this.api.shortlists({ jobId: params.jobId, limit: 100 }),
  });

  protected label(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  protected profile(s: Shortlist): Partial<CandidateProfile> | null {
    return refObj<Partial<CandidateProfile>>(s.candidateProfile);
  }

  protected profileId(s: Shortlist): string | null {
    return refId(s.candidateProfile as string | { id: string } | undefined);
  }

  protected name(s: Shortlist): string {
    return refName(s.candidate, 'Candidate');
  }

  protected by(s: Shortlist): string {
    return refName(s.shortlistedBy, 'a recruiter');
  }

  protected consent(s: Shortlist): boolean {
    return this.profile(s)?.consent?.profileSharing === true;
  }

  submit(s: Shortlist): void {
    this.modal
      .open<SubmitDialogComponent, SubmitDialogData, Submission>(SubmitDialogComponent, {
        data: { shortlist: s, companyName: this.companyName() },
        size: 'lg',
      })
      .afterClosed()
      .pipe(filter((r): r is Submission => !!r))
      .subscribe((sub) => {
        this.list.reload();
        this.changed.emit(sub);
      });
  }

  remove(s: Shortlist): void {
    this.confirm
      .open({
        title: `Remove ${this.name(s)} from the shortlist?`,
        message: 'The candidate will no longer be considered for this requirement unless shortlisted again.',
        confirmText: 'Remove',
        tone: 'danger',
        reason: { label: 'Reason (optional)' },
      })
      .pipe(
        filter((r) => !!r),
        switchMap((r) => this.api.removeShortlist(s.id, r?.reason)),
      )
      .subscribe((res) => {
        this.toast.success('Removed from shortlist');
        this.list.reload();
        this.changed.emit(res);
      });
  }
}
