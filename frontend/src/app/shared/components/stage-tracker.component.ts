import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CANDIDATE_STAGES, CandidateStage, STAGE_LABELS, StageHistoryEntry } from '../../core/models';

type StepState = 'done' | 'current' | 'upcoming';

/** Linear journey (terminal outcomes rejected / on_hold are shown separately). */
const JOURNEY: CandidateStage[] = CANDIDATE_STAGES.filter((s) => s !== 'rejected' && s !== 'on_hold');

const ICONS: Partial<Record<CandidateStage, string>> = {
  registered: 'bi-person-plus',
  profile_incomplete: 'bi-pencil-square',
  profile_completed: 'bi-person-check',
  under_review: 'bi-search',
  screening: 'bi-funnel',
  shortlisted: 'bi-star',
  submitted: 'bi-send',
  company_reviewing: 'bi-buildings',
  interview_requested: 'bi-chat-square-dots',
  interview_scheduled: 'bi-calendar2-event',
  interview_completed: 'bi-calendar2-check',
  selected: 'bi-hand-thumbs-up',
  placed: 'bi-trophy',
};

/**
 * The 15-stage Veejee Services candidate journey. Horizontal stepper on large screens, vertical list
 * on smaller ones. `rejected` / `on_hold` are terminal/paused states shown as a callout rather than a step.
 */
@Component({
  selector: 'app-stage-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="tracker" data-testid="stage-tracker">
      @if (offTrack(); as off) {
        <div class="alert d-flex gap-2 align-items-start" [class.alert-warning]="off === 'on_hold'" [class.alert-secondary]="off === 'rejected'" role="status">
          <i [class]="off === 'on_hold' ? 'bi bi-pause-circle-fill' : 'bi bi-info-circle-fill'" aria-hidden="true"></i>
          <span>
            <strong>{{ label(off) }}.</strong>
            {{ off === 'on_hold'
              ? 'Your application journey is paused for now. Your recruiter will update you.'
              : 'This opportunity did not work out, but your profile stays active with Veejee Services for future openings.' }}
          </span>
        </div>
      }
      <ol class="steps" aria-label="Your recruitment journey">
        @for (s of steps(); track s.stage; let i = $index) {
          <li class="step" [class]="'step ' + s.state" [attr.aria-current]="s.state === 'current' ? 'step' : null">
            <span class="dot" aria-hidden="true">
              @if (s.state === 'done') {
                <i class="bi bi-check-lg"></i>
              } @else {
                <i [class]="'bi ' + icon(s.stage)"></i>
              }
            </span>
            <span class="txt">
              <span class="lbl">{{ label(s.stage) }}</span>
              @if (s.at) {
                <time class="when" [attr.datetime]="s.at">{{ s.at | date: 'd MMM' }}</time>
              }
              <span class="visually-hidden">{{ s.state === 'done' ? '(completed)' : s.state === 'current' ? '(current stage)' : '(upcoming)' }}</span>
            </span>
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
    .step { position: relative; display: flex; gap: 12px; align-items: flex-start; padding-bottom: 14px; }
    .step:not(:last-child)::before { content: ''; position: absolute; left: 15px; top: 32px; bottom: 0; width: 2px; background: var(--an-border); }
    .step.done:not(:last-child)::before { background: var(--an-navy-700); }
    .dot { flex: none; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-surface-2); color: var(--an-text-muted); border: 2px solid var(--an-border); font-size: 0.9rem; position: relative; z-index: 1; }
    .done .dot { background: var(--an-navy-900); border-color: var(--an-navy-900); color: #fff; }
    .current .dot { background: var(--an-gold-500); border-color: var(--an-gold-500); color: var(--an-navy-950); box-shadow: 0 0 0 4px var(--an-gold-100); }
    .txt { display: flex; flex-direction: column; padding-top: 5px; min-width: 0; }
    .lbl { font-size: 0.88rem; color: var(--an-text-2); line-height: 1.25; }
    .done .lbl { color: var(--an-text); }
    .current .lbl { font-weight: 700; color: var(--an-navy-900); }
    .when { font-size: 0.75rem; color: var(--an-text-muted); }
    @media (min-width: 992px) {
      .steps { flex-direction: row; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
      .step { flex: 1 0 84px; flex-direction: column; align-items: center; text-align: center; padding: 0 2px; }
      .step:not(:last-child)::before { left: calc(50% + 16px); right: calc(-50% + 16px); top: 15px; bottom: auto; width: auto; height: 2px; }
      .txt { padding-top: 6px; align-items: center; }
      .lbl { font-size: 0.74rem; }
    }
  `,
})
export class StageTrackerComponent {
  readonly stage = input.required<CandidateStage>();
  readonly history = input<StageHistoryEntry[]>([]);

  protected readonly offTrack = computed<CandidateStage | null>(() => {
    const s = this.stage();
    return s === 'rejected' || s === 'on_hold' ? s : null;
  });

  /** For off-track stages, position the journey at the last on-track stage reached. */
  private readonly effectiveStage = computed<CandidateStage>(() => {
    if (!this.offTrack()) return this.stage();
    const reached = [...this.history()].reverse().find((h) => JOURNEY.includes(h.stage));
    return reached?.stage ?? 'registered';
  });

  protected readonly steps = computed(() => {
    const currentIndex = JOURNEY.indexOf(this.effectiveStage());
    const reachedAt = new Map<CandidateStage, string>();
    for (const h of this.history()) {
      if (!reachedAt.has(h.stage)) reachedAt.set(h.stage, h.at);
    }
    return JOURNEY.map((stage, i) => {
      const state: StepState = i < currentIndex ? 'done' : i === currentIndex ? (this.offTrack() ? 'done' : 'current') : 'upcoming';
      return { stage, state, at: i <= currentIndex ? reachedAt.get(stage) : undefined };
    });
  });

  label(stage: CandidateStage): string {
    return STAGE_LABELS[stage] ?? stage;
  }

  icon(stage: CandidateStage): string {
    return ICONS[stage] ?? 'bi-circle';
  }
}
