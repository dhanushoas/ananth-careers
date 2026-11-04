import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { CandidateInterview } from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

const MODE_ICONS: Record<string, string> = { in_person: 'bi-building', video: 'bi-camera-video', phone: 'bi-telephone' };

/** Interview coordinated by Veejee Services, with accept / decline for the candidate. */
@Component({
  selector: 'app-candidate-interview-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, StatusChipComponent, EnumLabelPipe],
  template: `
    @let iv = interview();
    <article class="card card-hover iv" data-testid="interview-item">
      <div class="card-body d-flex gap-3">
        <div class="date" aria-hidden="true">
          <span class="mon">{{ iv.scheduledAt | date: 'MMM' }}</span>
          <span class="day">{{ iv.scheduledAt | date: 'd' }}</span>
          <span class="time">{{ iv.scheduledAt | date: 'h:mm a' }}</span>
        </div>
        <div class="body">
          <h3 class="h6 mb-0 title">{{ iv.job?.title ?? 'Interview' }}</h3>
          <p class="company mb-2"><i class="bi bi-buildings" aria-hidden="true"></i> {{ iv.employer?.companyName ?? 'Veejee Services client' }}</p>
          <ul class="list-unstyled meta mb-0">
            <li>
              <i class="bi bi-clock" aria-hidden="true"></i>
              <time [attr.datetime]="iv.scheduledAt">{{ iv.scheduledAt | date: 'EEE, d MMM y, h:mm a' }}</time>
              · {{ iv.durationMinutes }} min
            </li>
            <li>
              <i [class]="'bi ' + modeIcon()" aria-hidden="true"></i>{{ iv.mode | enumLabel }}
              @if (iv.location) {
                · {{ iv.location }}
              }
            </li>
            @if (iv.meetingLink) {
              <li>
                <i class="bi bi-link-45deg" aria-hidden="true"></i>
                <a [href]="iv.meetingLink" target="_blank" rel="noopener noreferrer">Join meeting <i class="bi bi-box-arrow-up-right small" aria-hidden="true"></i></a>
              </li>
            }
          </ul>
          @if (iv.notes) {
            <p class="notes mt-2 mb-0">{{ iv.notes }}</p>
          }
          <div class="d-flex flex-wrap gap-2 mt-3">
            <app-status-chip [status]="iv.status" />
            <app-status-chip [status]="iv.candidateResponse" [label]="'Your response: ' + (iv.candidateResponse | enumLabel)" />
          </div>
          @if (canRespond()) {
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button class="btn btn-success" type="button" (click)="respond('accepted')" [disabled]="busy()">
                <i class="bi bi-check2-circle" aria-hidden="true"></i> Accept
              </button>
              <button class="btn btn-outline-danger" type="button" (click)="decline()" [disabled]="busy()">
                <i class="bi bi-x-circle" aria-hidden="true"></i> Decline
              </button>
            </div>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    .iv { border-left: 4px solid var(--an-gold-500); }
    .date { flex: none; width: 64px; padding: 8px 0; border-radius: 12px; background: linear-gradient(160deg, var(--an-navy-900), var(--an-navy-700));
      color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; align-self: flex-start; }
    .mon { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--an-gold-300); }
    .day { font-family: var(--an-font-heading); font-weight: 800; font-size: 1.5rem; line-height: 1.1; }
    .time { font-size: 0.66rem; color: var(--an-on-dark-2); }
    .body { flex: 1; min-width: 0; }
    .title { overflow-wrap: anywhere; color: var(--an-navy-900); }
    .company { color: var(--an-text-2); font-size: 0.9rem; }
    .meta { display: grid; gap: 4px; font-size: 0.88rem; color: var(--an-text-2); }
    .meta li { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; overflow-wrap: anywhere; }
    .meta .bi { color: var(--an-text-muted); }
    .notes { font-size: 0.88rem; background: var(--an-surface-2); padding: 8px 12px; border-radius: var(--an-radius-sm); white-space: pre-line; }
  `,
})
export class CandidateInterviewCardComponent {
  readonly interview = input.required<CandidateInterview>();
  readonly updated = output<CandidateInterview>();

  private readonly api = inject(CandidateService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  protected readonly modeIcon = computed(() => MODE_ICONS[this.interview().mode] ?? 'bi-calendar-event');
  protected readonly canRespond = computed(() => {
    const iv = this.interview();
    return (
      iv.candidateResponse === 'pending' &&
      (iv.status === 'scheduled' || iv.status === 'rescheduled') &&
      new Date(iv.scheduledAt).getTime() > Date.now()
    );
  });

  respond(response: 'accepted' | 'declined', note?: string): void {
    this.busy.set(true);
    this.api
      .respondInterview(this.interview().id, response, note)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe((iv) => {
        this.toast.success(response === 'accepted' ? 'Interview accepted' : 'Interview declined');
        this.updated.emit({ ...this.interview(), ...iv, candidateResponse: response });
      });
  }

  decline(): void {
    this.confirm
      .open({
        title: 'Decline this interview?',
        message: 'Veejee Services will be notified and will coordinate with the company. You can add a short note.',
        confirmText: 'Decline interview',
        tone: 'danger',
        reason: { label: 'Note (optional)', maxLength: 500 },
      })
      .subscribe((result) => {
        if (result) {
          this.respond('declined', result.reason);
        }
      });
  }
}
