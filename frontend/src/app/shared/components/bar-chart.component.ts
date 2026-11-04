import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface ChartDatum {
  label: string;
  value: number;
}

/**
 * Accessible horizontal bar chart (single series, one hue). Direct value labels, hover/focus
 * highlight, and a "Show table" toggle for a tabular view.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <figure class="chart">
      <figcaption class="row-between">
        <span class="caption">{{ title() }}</span>
        @if (data().length) {
          <button type="button" class="toggle" (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()">
            {{ showTable() ? 'Show chart' : 'Show table' }}
          </button>
        }
      </figcaption>
      @if (!data().length) {
        <p class="empty">No data yet.</p>
      } @else if (showTable()) {
        <table class="data-table">
          <thead><tr><th scope="col">{{ labelHeader() }}</th><th scope="col">{{ valueHeader() }}</th></tr></thead>
          <tbody>
            @for (d of data(); track d.label) {
              <tr><td>{{ d.label }}</td><td>{{ d.value | number }}</td></tr>
            }
          </tbody>
        </table>
      } @else {
        <ul class="bars" role="list">
          @for (d of data(); track d.label) {
            <li class="bar-row" tabindex="0" [attr.aria-label]="d.label + ': ' + d.value" [class.active]="hover() === d.label"
                (mouseenter)="hover.set(d.label)" (mouseleave)="hover.set(null)" (focus)="hover.set(d.label)" (blur)="hover.set(null)">
              <span class="label" [title]="d.label">{{ d.label }}</span>
              <span class="track"><span class="fill" [style.width.%]="pct(d.value)"></span></span>
              <span class="value">{{ d.value | number }}</span>
            </li>
          }
        </ul>
      }
    </figure>
  `,
  styles: `
    .chart { margin: 0; }
    .caption { font-weight: 600; color: var(--an-text); }
    figcaption { margin-bottom: var(--an-space-3); }
    .toggle {
      background: none; border: 0; padding: 4px; font: inherit; font-size: 0.82rem;
      color: var(--an-navy-700); text-decoration: underline; cursor: pointer;
    }
    .empty { color: var(--an-text-muted); margin: 0; }
    .bars { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .bar-row {
      display: grid; grid-template-columns: minmax(80px, 34%) 1fr auto; gap: var(--an-space-3);
      align-items: center; font-size: 0.86rem; border-radius: 6px; padding: 2px 4px; outline-offset: 1px;
    }
    .bar-row.active { background: var(--an-navy-50); }
    .label { color: var(--an-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track { height: 10px; background: var(--an-surface-2); border-radius: 0 4px 4px 0; overflow: hidden; }
    .fill { display: block; height: 100%; min-width: 2px; background: var(--an-navy-700); border-radius: 0 4px 4px 0;
      transition: width 400ms var(--an-ease); }
    .bar-row.active .fill { background: var(--an-navy-900); }
    .value { font-variant-numeric: tabular-nums; color: var(--an-text); font-weight: 600; min-width: 2ch; text-align: right; }
  `,
})
export class BarChartComponent {
  readonly title = input('');
  readonly data = input<ChartDatum[]>([]);
  readonly labelHeader = input('Category');
  readonly valueHeader = input('Count');
  protected readonly showTable = signal(false);
  protected readonly hover = signal<string | null>(null);
  private readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));

  pct(value: number): number {
    return (value / this.max()) * 100;
  }
}
