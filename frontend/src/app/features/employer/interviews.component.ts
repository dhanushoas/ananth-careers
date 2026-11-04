import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { CandidateInterview, InterviewFeedback } from '../../core/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { ModalService } from '../../shared/ui/modal.service';
import { FeedbackData, InterviewFeedbackDialogComponent, canGiveFeedback, interviewModeIcon } from './employer-ui';

/** Interviews Veejee Services has scheduled with submitted candidates. */
@Component({
  selector: 'app-employer-interviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent, PageHeaderComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe],
  template: `
    <app-page-header eyebrow="Interviews" title="Interviews" illustration="interviews"
      subtitle="Veejee Services schedules interviews with candidates on your behalf. Share feedback here after each interview." />

    <ul class="nav nav-pills mb-4" aria-label="Interview filter">
      <li class="nav-item"><button class="nav-link" type="button" [class.active]="upcoming()" [attr.aria-pressed]="upcoming()" (click)="upcoming.set(true)">Upcoming</button></li>
      <li class="nav-item"><button class="nav-link" type="button" [class.active]="!upcoming()" [attr.aria-pressed]="!upcoming()" (click)="upcoming.set(false)">All</button></li>
    </ul>

    @if (list.isLoading()) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (list.error()) {
      <app-empty-state tone="error" title="Interviews could not be loaded">
        <button class="btn btn-primary" type="button" (click)="list.reload()">Retry</button>
      </app-empty-state>
    } @else {
      <div class="d-grid gap-3">
        @for (iv of sorted(); track iv.id) {
          <article class="card iv" [class.past]="isPast(iv)" data-testid="employer-interview">
            <div class="card-body">
              <div class="date" aria-hidden="true">
                <span class="m">{{ iv.scheduledAt | date: 'MMM' }}</span>
                <span class="d">{{ iv.scheduledAt | date: 'd' }}</span>
              </div>
              <div class="grow">
                <h2 class="h6 mb-1">{{ candidateName(iv) }}</h2>
                <p class="small text-secondary mb-1">{{ iv.job?.title }}</p>
                <p class="small mb-0">
                  <i [class]="'bi ' + modeIcon(iv.mode)" aria-hidden="true"></i>
                  {{ iv.scheduledAt | date: 'EEE, d MMM y, h:mm a' }} · {{ iv.mode | enumLabel }} · {{ iv.durationMinutes }} min
                  @if (iv.location) { · {{ iv.location }} }
                </p>
                @if (iv.meetingLink) {
                  <a class="small" [href]="iv.meetingLink" target="_blank" rel="noopener noreferrer">Join meeting <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>
                }
              </div>
              <div class="actions">
                <app-status-chip [status]="iv.status" />
                @if (submissionId(iv); as sid) {
                  <a class="btn btn-sm btn-outline-primary" [routerLink]="['/employer/candidates', sid]">View candidate</a>
                }
                @if (iv.status !== 'cancelled') {
                  @if (sent().has(iv.id)) {
                    <span class="badge text-bg-success">Feedback sent</span>
                  } @else {
                    <button class="btn btn-sm btn-primary" type="button" (click)="feedback(iv)" [disabled]="!canFeedback(iv)"
                      [attr.title]="canFeedback(iv) ? null : 'Available after the interview time'">
                      <i class="bi bi-chat-square-text" aria-hidden="true"></i> Feedback
                    </button>
                  }
                }
              </div>
            </div>
          </article>
        } @empty {
          <app-empty-state illustration="empty-interviews" [title]="upcoming() ? 'No upcoming interviews' : 'No interviews yet'"
            message="Request an interview from a submitted candidate's page and Veejee Services will schedule it.">
            <a class="btn btn-outline-primary" routerLink="/employer/candidates">Submitted candidates</a>
          </app-empty-state>
        }
      </div>
    }
  `,
  styles: `
    .iv .card-body { display: flex; flex-wrap: wrap; gap: var(--an-space-3); align-items: center; }
    .iv { border-left: 4px solid var(--an-gold-500); }
    .iv.past { border-left-color: var(--an-border-strong); }
    .date { width: 60px; flex: none; text-align: center; border-radius: 12px; background: var(--an-navy-900); color: #fff; padding: 6px 0; }
    .date .m { display: block; font-size: 0.72rem; text-transform: uppercase; color: var(--an-gold-300); }
    .date .d { display: block; font-size: 1.4rem; font-weight: 800; line-height: 1.1; }
    .grow { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--an-space-2); align-items: center; }
  `,
})
export default class EmployerInterviewsComponent {
  private readonly api = inject(EmployerPortalService);
  private readonly modal = inject(ModalService);
  protected readonly upcoming = signal(true);
  protected readonly sent = signal(new Set<string>());
  protected readonly list = rxResource({ params: () => this.upcoming(), stream: ({ params }) => this.api.interviews(params) });
  protected readonly sorted = computed(() =>
    [...(this.list.value() ?? [])].sort((a, b) =>
      this.upcoming()
        ? new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        : new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    ),
  );
  protected readonly modeIcon = interviewModeIcon;
  protected readonly canFeedback = canGiveFeedback;

  isPast(iv: CandidateInterview): boolean {
    return new Date(iv.scheduledAt).getTime() < Date.now();
  }

  candidateName(iv: CandidateInterview): string {
    const c = iv.candidate;
    return c && typeof c === 'object' ? c.name : 'Candidate';
  }

  submissionId(iv: CandidateInterview): string | null {
    return iv.submission ?? null;
  }

  feedback(iv: CandidateInterview): void {
    this.modal
      .open<InterviewFeedbackDialogComponent, FeedbackData, InterviewFeedback>(InterviewFeedbackDialogComponent, {
        data: { interview: iv, candidateName: this.candidateName(iv) },
      })
      .afterClosed()
      .subscribe((f) => {
        if (f) this.sent.update((s) => new Set(s).add(iv.id));
      });
  }
}
