import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { StatusHistoryEntry } from '../../core/models';
import { EnumLabelPipe } from '../pipes/enum-label.pipe';

/** Vertical timeline of application status changes (newest last). */
@Component({
  selector: 'app-status-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, EnumLabelPipe],
  template: `
    <ol class="timeline" aria-label="Application status history">
      @for (e of entries(); track $index; let last = $last) {
        <li [class.current]="last" [class]="'s-' + e.status">
          <span class="dot" aria-hidden="true"></span>
          <div class="body">
            <p class="status">{{ e.status | enumLabel }}</p>
            <p class="when">
              <time [attr.datetime]="e.at">{{ e.at | date: 'medium' }}</time>
              @if (e.changedBy?.name) {
                · by {{ e.changedBy.name }}
              }
            </p>
            @if (e.note) {
              <p class="note">{{ e.note }}</p>
            }
          </div>
        </li>
      } @empty {
        <li class="empty">No status updates yet.</li>
      }
    </ol>
  `,
  styles: `
    .timeline { list-style: none; margin: 0; padding: 0; }
    li { position: relative; display: flex; gap: var(--an-space-3); padding-bottom: var(--an-space-4); }
    li:not(:last-child)::before {
      content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: var(--an-border);
    }
    .dot { flex: none; width: 16px; height: 16px; margin-top: 3px; border-radius: 50%; background: var(--an-surface);
      border: 3px solid var(--an-border-strong); }
    .current .dot { border-color: var(--an-gold-500); background: var(--an-gold-100); }
    .s-selected .dot { border-color: var(--an-success); }
    .s-rejected .dot, .s-withdrawn .dot { border-color: var(--an-danger); }
    .status { margin: 0; font-weight: 600; }
    .when { margin: 0; font-size: 0.83rem; color: var(--an-text-muted); }
    .note { margin: var(--an-space-1) 0 0; font-size: 0.9rem; color: var(--an-text-2); background: var(--an-surface-2);
      padding: var(--an-space-2) var(--an-space-3); border-radius: var(--an-radius-sm); white-space: pre-line; }
    .empty { color: var(--an-text-muted); }
  `,
})
export class StatusTimelineComponent {
  readonly history = input<StatusHistoryEntry[]>([]);
  protected readonly entries = computed(() =>
    [...this.history()].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
  );
}
