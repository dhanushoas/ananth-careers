import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CandidateInterview } from '../../../core/models';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { InterviewActions } from './interview-actions.service';
import { refName } from './recruiter-utils';

const MODE_ICON: Record<string, string> = { in_person: 'bi-geo-alt', video: 'bi-camera-video', phone: 'bi-telephone' };

/** One interview with reschedule / cancel / complete actions. */
@Component({
  selector: 'app-interview-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, StatusChipComponent, EnumLabelPipe],
  template: `
    @let iv = interview();
    <article class="iv card" [class.past]="isPast()" data-testid="recruiter-interview">
      <div class="card-body d-flex flex-wrap gap-3 align-items-start">
        <div class="when" aria-hidden="true">
          <span class="d">{{ iv.scheduledAt | date: 'd' }}</span>
          <span class="m">{{ iv.scheduledAt | date: 'MMM' }}</span>
        </div>
        <div class="grow">
          <p class="mb-1 fw-semibold">
            <i [class]="'bi ' + modeIcon()" aria-hidden="true"></i>
            {{ iv.scheduledAt | date: 'EEE d MMM, h:mm a' }} · {{ iv.durationMinutes }} min · {{ iv.mode | enumLabel }}
          </p>
          @if (showContext()) {
            <p class="small mb-1">
              <strong>{{ candidate() }}</strong>
              @if (iv.job; as job) { · {{ job.title }} }
              @if (iv.employer; as emp) { · {{ emp.companyName }} }
            </p>
          }
          @if (iv.location) {
            <p class="small text-secondary mb-1"><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ iv.location }}</p>
          }
          @if (iv.meetingLink) {
            <p class="small mb-1 text-truncate"><a [href]="iv.meetingLink" target="_blank" rel="noopener noreferrer"><i class="bi bi-link-45deg" aria-hidden="true"></i> {{ iv.meetingLink }}</a></p>
          }
          <div class="d-flex flex-wrap gap-2 mt-1">
            <app-status-chip [status]="iv.status" />
            <app-status-chip [status]="iv.candidateResponse" [label]="'Candidate: ' + (iv.candidateResponse | enumLabel)" />
          </div>
        </div>
        <div class="actions">
          @if (iv.submission && showContext()) {
            <a class="btn btn-sm btn-outline-primary" [routerLink]="['/recruiter/submissions', iv.submission]">Open</a>
          }
          @if (iv.status === 'scheduled' || iv.status === 'rescheduled') {
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="reschedule()"><i class="bi bi-calendar2-week" aria-hidden="true"></i> Reschedule</button>
            <button type="button" class="btn btn-sm btn-outline-success" (click)="complete()"><i class="bi bi-check2-circle" aria-hidden="true"></i> Mark completed</button>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="cancel()"><i class="bi bi-x-circle" aria-hidden="true"></i> Cancel</button>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    .iv { border-left: 4px solid var(--an-gold-500); }
    .iv.past { border-left-color: var(--an-border-strong); }
    .when { width: 56px; flex: none; text-align: center; border-radius: 12px; background: var(--an-navy-900); color: #fff; padding: 6px 0; line-height: 1.1; }
    .when .d { display: block; font-size: 1.35rem; font-weight: 800; font-family: var(--an-font-heading); }
    .when .m { display: block; font-size: 0.72rem; text-transform: uppercase; color: var(--an-gold-300); letter-spacing: 0.08em; }
    .grow { flex: 1 1 220px; min-width: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  `,
})
export class InterviewItemComponent {
  readonly interview = input.required<CandidateInterview>();
  /** Show candidate / requirement / company context (agenda view). */
  readonly showContext = input(false);
  readonly changed = output<CandidateInterview>();

  private readonly actions = inject(InterviewActions);
  protected readonly modeIcon = computed(() => MODE_ICON[this.interview().mode] ?? 'bi-calendar-event');
  protected readonly candidate = computed(() => refName(this.interview().candidate, 'Candidate'));
  protected readonly isPast = computed(() => new Date(this.interview().scheduledAt).getTime() < Date.now());

  reschedule(): void {
    const iv = this.interview();
    this.actions
      .schedule({ submissionId: iv.submission ?? '', interview: iv, candidateName: this.candidate(), companyName: iv.employer?.companyName })
      .subscribe((r) => this.changed.emit({ ...iv, ...r }));
  }

  cancel(): void {
    this.actions.cancel(this.interview()).subscribe((r) => this.changed.emit(r));
  }

  complete(): void {
    this.actions.complete(this.interview()).subscribe((r) => this.changed.emit(r));
  }
}
