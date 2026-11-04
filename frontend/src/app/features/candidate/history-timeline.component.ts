import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

export interface HistoryItem {
  status: string;
  note?: string;
  at: string;
}

/** Compact vertical status timeline (oldest first) for v2 application / submission histories. */
@Component({
  selector: 'app-history-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, EnumLabelPipe],
  template: `
    <ol class="tl" [attr.aria-label]="label()">
      @for (e of entries(); track $index; let last = $last) {
        <li [class.current]="last">
          <span class="dot" aria-hidden="true"></span>
          <div class="min-w-0">
            <p class="st">{{ e.status | enumLabel }}</p>
            <time class="when" [attr.datetime]="e.at">{{ e.at | date: 'medium' }}</time>
            @if (e.note) {
              <p class="note">{{ e.note }}</p>
            }
          </div>
        </li>
      } @empty {
        <li class="text-secondary small">No updates yet.</li>
      }
    </ol>
  `,
  styles: `
    .tl { list-style: none; margin: 0; padding: 0; }
    li { position: relative; display: flex; gap: 12px; padding-bottom: 14px; }
    li:not(:last-child)::before { content: ''; position: absolute; left: 6px; top: 16px; bottom: 0; width: 2px; background: var(--an-border); }
    .dot { flex: none; width: 14px; height: 14px; margin-top: 4px; border-radius: 50%; border: 3px solid var(--an-border-strong); background: var(--an-surface); }
    .current .dot { border-color: var(--an-gold-500); background: var(--an-gold-100); }
    .st { margin: 0; font-weight: 600; font-size: 0.92rem; }
    .when { font-size: 0.78rem; color: var(--an-text-muted); }
    .note { margin: 4px 0 0; font-size: 0.86rem; color: var(--an-text-2); background: var(--an-surface-2); padding: 6px 10px; border-radius: var(--an-radius-sm); white-space: pre-line; overflow-wrap: anywhere; }
    .min-w-0 { min-width: 0; }
  `,
})
export class HistoryTimelineComponent {
  readonly history = input<HistoryItem[]>([]);
  readonly label = input('Status history');
  protected readonly entries = computed(() => [...this.history()].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()));
}
