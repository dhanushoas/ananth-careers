import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

export interface TimePoint {
  date: string;
  count: number;
}

const W = 600;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 32 };

/** Single-series area/line chart for daily counts with a hover crosshair + tooltip. */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <figure class="chart">
      <figcaption class="row-between">
        <span class="caption">{{ title() }}</span>
        @if (points().length) {
          <button type="button" class="toggle" (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()">
            {{ showTable() ? 'Show chart' : 'Show table' }}
          </button>
        }
      </figcaption>
      @if (!points().length) {
        <p class="empty">No data yet.</p>
      } @else if (showTable()) {
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th scope="col">Date</th><th scope="col">{{ valueLabel() }}</th></tr></thead>
            <tbody>
              @for (p of points(); track p.date) {
                <tr><td>{{ p.date | date: 'mediumDate' }}</td><td>{{ p.count | number }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="plot">
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" role="img"
               [attr.aria-label]="title() + '. Total ' + total() + '. Peak ' + maxValue() + '.'"
               (mousemove)="onMove($event)" (mouseleave)="active.set(null)">
            @for (g of gridLines(); track g.y) {
              <line [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="g.y" [attr.y2]="g.y" class="grid" />
              <text [attr.x]="pad.left - 6" [attr.y]="g.y + 4" class="axis" text-anchor="end">{{ g.label }}</text>
            }
            <path [attr.d]="areaPath()" class="area" />
            <path [attr.d]="linePath()" class="line" />
            @if (activePoint(); as a) {
              <line [attr.x1]="a.x" [attr.x2]="a.x" [attr.y1]="pad.top" [attr.y2]="h - pad.bottom" class="cross" />
              <circle [attr.cx]="a.x" [attr.cy]="a.y" r="4.5" class="dot" />
            }
            <text [attr.x]="pad.left" [attr.y]="h - 6" class="axis">{{ points()[0].date | date: 'd MMM' }}</text>
            <text [attr.x]="w - pad.right" [attr.y]="h - 6" class="axis" text-anchor="end">{{ points()[points().length - 1].date | date: 'd MMM' }}</text>
          </svg>
          @if (activePoint(); as a) {
            <div class="tooltip" [style.left.%]="(a.x / w) * 100" role="status">
              <strong>{{ a.count | number }}</strong> {{ valueLabel().toLowerCase() }}<br />
              <span>{{ a.date | date: 'EEE, d MMM' }}</span>
            </div>
          }
        </div>
      }
    </figure>
  `,
  styles: `
    .chart { margin: 0; }
    .caption { font-weight: 600; }
    figcaption { margin-bottom: var(--an-space-3); }
    .toggle { background: none; border: 0; padding: 4px; font: inherit; font-size: 0.82rem; color: var(--an-navy-700); text-decoration: underline; cursor: pointer; }
    .empty { color: var(--an-text-muted); margin: 0; }
    .plot { position: relative; }
    svg { width: 100%; height: 200px; display: block; overflow: visible; }
    .grid { stroke: var(--an-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .axis { font-size: 11px; fill: var(--an-text-muted); }
    .area { fill: rgba(28, 55, 95, 0.12); }
    .line { fill: none; stroke: var(--an-navy-700); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .cross { stroke: var(--an-text-muted); stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
    .dot { fill: var(--an-navy-900); stroke: #fff; stroke-width: 2; vector-effect: non-scaling-stroke; }
    .tooltip {
      position: absolute; top: 0; transform: translateX(-50%); pointer-events: none;
      background: var(--an-navy-900); color: #fff; padding: 6px 10px; border-radius: 8px; font-size: 0.8rem;
      white-space: nowrap; box-shadow: var(--an-shadow-2);
    }
    .tooltip span { color: var(--an-on-dark-2); }
    .table-scroll { max-height: 260px; overflow: auto; }
  `,
})
export class LineChartComponent {
  readonly title = input('');
  readonly points = input<TimePoint[]>([]);
  readonly valueLabel = input('Applications');

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly showTable = signal(false);
  protected readonly active = signal<number | null>(null);

  protected readonly maxValue = computed(() => Math.max(0, ...this.points().map((p) => p.count)));
  protected readonly total = computed(() => this.points().reduce((s, p) => s + p.count, 0));
  private readonly niceMax = computed(() => {
    const m = this.maxValue();
    if (m <= 4) return 4;
    const step = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / step) * step;
  });

  private readonly coords = computed(() => {
    const pts = this.points();
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = Math.max(1, pts.length - 1);
    return pts.map((p, i) => ({
      ...p,
      x: PAD.left + (pts.length === 1 ? innerW / 2 : (i / n) * innerW),
      y: PAD.top + innerH - (p.count / this.niceMax()) * innerH,
    }));
  });

  protected readonly linePath = computed(() =>
    this.coords()
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const c = this.coords();
    if (!c.length) return '';
    const base = H - PAD.bottom;
    return `${this.linePath()} L${c[c.length - 1].x.toFixed(1)},${base} L${c[0].x.toFixed(1)},${base} Z`;
  });

  protected readonly gridLines = computed(() => {
    const max = this.niceMax();
    const innerH = H - PAD.top - PAD.bottom;
    return [0, 0.5, 1].map((f) => ({ y: PAD.top + innerH - f * innerH, label: String(Math.round(max * f)) }));
  });

  protected readonly activePoint = computed(() => {
    const i = this.active();
    return i === null ? null : (this.coords()[i] ?? null);
  });

  onMove(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const c = this.coords();
    let best = 0;
    for (let i = 1; i < c.length; i++) {
      if (Math.abs(c[i].x - x) < Math.abs(c[best].x - x)) best = i;
    }
    this.active.set(c.length ? best : null);
  }
}
