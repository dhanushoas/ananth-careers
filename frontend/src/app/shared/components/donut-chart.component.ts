import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ChartDatum } from './bar-chart.component';

/** Fixed categorical order (identity colours never cycle; a 7th+ category folds into "Other"). */
const PALETTE = ['#0B2A5B', '#F7821B', '#146C43', '#1D4F91', '#66738A', '#B85A00'];
const OTHER_COLOR = '#C3CCDA';
const R = 60;
const STROKE = 22;
const C = 2 * Math.PI * R;

interface Slice extends ChartDatum {
  color: string;
  dash: string;
  offset: number;
  pct: number;
}

/** Accessible SVG donut chart with legend + table toggle. */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <figure class="chart">
      <figcaption class="head">
        <span class="caption">{{ title() }}</span>
        @if (slices().length) {
          <button type="button" class="toggle" (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()">
            {{ showTable() ? 'Show chart' : 'Show table' }}
          </button>
        }
      </figcaption>
      @if (!slices().length) {
        <p class="empty">No data yet.</p>
      } @else if (showTable()) {
        <table class="table table-sm mb-0">
          <thead><tr><th scope="col">Category</th><th scope="col" class="text-end">Count</th><th scope="col" class="text-end">Share</th></tr></thead>
          <tbody>
            @for (s of slices(); track s.label) {
              <tr><td>{{ s.label }}</td><td class="text-end">{{ s.value | number }}</td><td class="text-end">{{ s.pct | number: '1.0-1' }}%</td></tr>
            }
          </tbody>
        </table>
      } @else {
        <div class="body">
          <div class="plot">
            <svg viewBox="0 0 160 160" role="img" [attr.aria-label]="ariaSummary()">
              <circle cx="80" cy="80" [attr.r]="r" fill="none" stroke="#EEF1F5" [attr.stroke-width]="stroke" />
              @for (s of slices(); track s.label) {
                <circle
                  cx="80" cy="80" [attr.r]="r" fill="none"
                  [attr.stroke]="s.color"
                  [attr.stroke-width]="active() === s.label ? stroke + 4 : stroke"
                  [attr.stroke-dasharray]="s.dash"
                  [attr.stroke-dashoffset]="s.offset"
                  transform="rotate(-90 80 80)"
                  class="seg"
                  [class.dim]="active() !== null && active() !== s.label"
                  (mouseenter)="active.set(s.label)" (mouseleave)="active.set(null)"
                />
              }
              <text x="80" y="78" text-anchor="middle" class="total">{{ centerValue() | number }}</text>
              <text x="80" y="96" text-anchor="middle" class="sub">{{ centerText() }}</text>
            </svg>
          </div>
          <ul class="legend">
            @for (s of slices(); track s.label) {
              <li>
                <button type="button" class="legend-item" [class.on]="active() === s.label"
                  (mouseenter)="active.set(s.label)" (mouseleave)="active.set(null)"
                  (focus)="active.set(s.label)" (blur)="active.set(null)"
                  [attr.aria-label]="s.label + ': ' + s.value + ' (' + (s.pct | number: '1.0-1') + '%)'">
                  <span class="sw" [style.background]="s.color"></span>
                  <span class="lbl">{{ s.label }}</span>
                  <span class="val">{{ s.value | number }}</span>
                </button>
              </li>
            }
          </ul>
        </div>
      }
    </figure>
  `,
  styles: `
    .chart { margin: 0; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: var(--an-space-3); }
    .caption { font-weight: 600; color: var(--an-text); }
    .toggle { background: none; border: 0; padding: 4px; font: inherit; font-size: 0.82rem; color: var(--an-navy-700); text-decoration: underline; cursor: pointer; }
    .empty { color: var(--an-text-muted); margin: 0; }
    .body { display: flex; flex-wrap: wrap; align-items: center; gap: var(--an-space-4); }
    .plot { flex: 0 0 auto; width: min(180px, 100%); margin-inline: auto; }
    svg { display: block; width: 100%; height: auto; }
    .seg { transition: stroke-width 150ms ease, opacity 150ms ease; cursor: pointer; }
    .seg.dim { opacity: 0.35; }
    .total { font-size: 22px; font-weight: 800; fill: var(--an-navy-900); font-family: var(--an-font-heading); }
    .sub { font-size: 10px; fill: var(--an-text-muted); }
    .legend { list-style: none; margin: 0; padding: 0; flex: 1 1 180px; min-width: 0; display: grid; gap: 2px; }
    .legend-item { width: 100%; display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 8px; padding: 6px 8px;
      border: 0; border-radius: 8px; background: none; font: inherit; font-size: 0.88rem; color: var(--an-text); text-align: left; cursor: default; min-height: 36px; }
    .legend-item.on, .legend-item:hover { background: var(--an-navy-50); }
    .sw { width: 12px; height: 12px; border-radius: 3px; }
    .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--an-text-2); }
    .val { font-weight: 700; font-variant-numeric: tabular-nums; }
    @media (prefers-reduced-motion: reduce) { .seg { transition: none; } }
  `,
})
export class DonutChartComponent {
  readonly title = input('');
  readonly data = input<ChartDatum[]>([]);
  readonly centerLabel = input('Total');

  protected readonly r = R;
  protected readonly stroke = STROKE;
  protected readonly showTable = signal(false);
  protected readonly active = signal<string | null>(null);

  private readonly total = computed(() => this.data().reduce((s, d) => s + Math.max(0, d.value), 0));

  protected readonly slices = computed<Slice[]>(() => {
    const total = this.total();
    if (total <= 0) return [];
    const items = this.data().filter((d) => d.value > 0);
    // At most 6 slices: keep the first 5 and fold the remainder into "Other".
    const keep = items.length > PALETTE.length ? PALETTE.length - 1 : items.length;
    const head = items.slice(0, keep);
    const rest = items.slice(keep);
    const list: (ChartDatum & { color: string })[] = head.map((d, i) => ({ ...d, color: PALETTE[i] }));
    if (rest.length) {
      const folded = rest.reduce((s, d) => s + d.value, 0);
      list.push({ label: 'Other', value: folded, color: OTHER_COLOR });
    }
    const gap = list.length > 1 ? 2 : 0; // 2px surface gap between segments
    let acc = 0;
    return list.map((d) => {
      const len = (d.value / total) * C;
      const visible = Math.max(0.5, len - gap);
      const slice: Slice = { ...d, dash: `${visible} ${C - visible}`, offset: -acc, pct: (d.value / total) * 100 };
      acc += len;
      return slice;
    });
  });

  protected readonly centerValue = computed(() => {
    const a = this.active();
    const s = a ? this.slices().find((x) => x.label === a) : undefined;
    return s ? s.value : this.total();
  });
  protected readonly centerText = computed(() => this.active() ?? this.centerLabel());
  protected readonly ariaSummary = computed(
    () => `${this.title()}: ` + this.slices().map((s) => `${s.label} ${s.value}`).join(', '),
  );
}
