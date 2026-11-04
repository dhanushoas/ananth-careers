import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { enumLabel } from '../pipes/enum-label.pipe';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

const TONES: Record<string, Tone> = {
  published: 'success',
  verified: 'success',
  approved: 'success',
  active: 'success',
  selected: 'success',
  accepted: 'success',
  completed: 'success',
  resolved: 'success',
  sent: 'success',
  pending_approval: 'warning',
  registered: 'neutral',
  profile_incomplete: 'warning',
  profile_completed: 'info',
  screening: 'info',
  submitted: 'info',
  company_reviewing: 'info',
  interview_requested: 'gold',
  interview_completed: 'info',
  on_hold: 'warning',
  placed: 'success',
  not_shortlisted: 'danger',
  removed: 'neutral',
  suppressed: 'neutral',
  reviewing: 'info',
  next_round: 'gold',
  select: 'success',
  reject: 'danger',
  pending: 'warning',
  under_review: 'info',
  applied: 'info',
  scheduled: 'info',
  in_progress: 'info',
  new: 'gold',
  queued: 'warning',
  shortlisted: 'gold',
  interview_scheduled: 'gold',
  rescheduled: 'gold',
  featured: 'gold',
  rejected: 'danger',
  blocked: 'danger',
  declined: 'danger',
  failed: 'danger',
  cancelled: 'neutral',
  withdrawn: 'neutral',
  closed: 'neutral',
  draft: 'neutral',
};

const ICONS: Record<Tone, string> = {
  success: 'bi-check-circle-fill',
  warning: 'bi-hourglass-split',
  danger: 'bi-x-circle-fill',
  info: 'bi-info-circle-fill',
  gold: 'bi-star-fill',
  neutral: 'bi-circle',
};

/** Status badge (Bootstrap `.badge`). Icon + label so status never relies on colour alone. */
@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge rounded-pill status-badge tone-' + tone()"
    ><i [class]="'bi ' + icon()" aria-hidden="true"></i>{{ text() }}</span
  >`,
  styles: `
    :host { display: inline-flex; max-width: 100%; min-width: 0; }
    .status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; padding: 0.35em 0.75em; border: 1px solid transparent; white-space: normal; text-align: left; line-height: 1.25; max-width: 100%; overflow-wrap: anywhere; }
    .status-badge .bi { font-size: 0.8em; }
    .tone-success { background: var(--an-success-bg); color: var(--an-success); border-color: #b7e0c7; }
    .tone-warning { background: var(--an-warning-bg); color: var(--an-warning); border-color: #f2d7a6; }
    .tone-danger { background: var(--an-danger-bg); color: var(--an-danger); border-color: #f5c2bd; }
    .tone-info { background: var(--an-info-bg); color: var(--an-info); border-color: #c5d7f2; }
    .tone-gold { background: var(--an-gold-100); color: var(--an-gold-700); border-color: var(--an-gold-300); }
    .tone-neutral { background: var(--an-neutral-bg); color: var(--an-neutral); border-color: var(--an-border); }
  `,
})
export class StatusChipComponent {
  readonly status = input.required<string>();
  readonly label = input<string>();
  protected readonly tone = computed<Tone>(() => TONES[this.status()] ?? 'neutral');
  protected readonly icon = computed(() => ICONS[this.tone()]);
  protected readonly text = computed(() => this.label() ?? enumLabel(this.status()));
}
