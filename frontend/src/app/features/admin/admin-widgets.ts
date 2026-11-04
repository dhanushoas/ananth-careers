import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

export interface MonthlyPoint {
  month: string;
  candidates: number;
  submissions: number;
  placements: number;
}

type SeriesKey = 'candidates' | 'submissions' | 'placements';

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'candidates', label: 'New candidates', color: '#1D4380' },
  { key: 'submissions', label: 'Submissions to companies', color: '#F7821B' },
  { key: 'placements', label: 'Placements', color: '#146C43' },
];

/** `2026-11` → Date for the 1st of that month. */
function monthDate(m: string): Date {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, (mo || 1) - 1, 1);
}

/** Grouped column chart for 12 months × 3 series, with legend, hover values and a table view. */
@Component({
  selector: 'app-monthly-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <figure class="m-0">
      <figcaption class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <span class="fw-semibold">{{ title() }}</span>
        @if (points().length) {
          <button type="button" class="btn btn-link btn-sm p-0" (click)="table.set(!table())" [attr.aria-pressed]="table()">
            {{ table() ? 'Show chart' : 'Show table' }}
          </button>
        }
      </figcaption>
      <ul class="legend">
        @for (s of series; track s.key) {
          <li><span class="sw" [style.background]="s.color" aria-hidden="true"></span>{{ s.label }}</li>
        }
      </ul>
      @if (!points().length) {
        <p class="text-secondary mb-0">No data yet.</p>
      } @else if (table()) {
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th scope="col">Month</th>@for (s of series; track s.key) {<th scope="col" class="text-end">{{ s.label }}</th>}</tr></thead>
            <tbody>
              @for (p of points(); track p.month) {
                <tr>
                  <td>{{ date(p.month) | date: 'MMM y' }}</td>
                  @for (s of series; track s.key) {<td class="text-end">{{ p[s.key] | number }}</td>}
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="plot" role="img" [attr.aria-label]="summary()">
          @for (p of points(); track p.month) {
            <div class="col-group" tabindex="0" [attr.aria-label]="monthLabel(p)" (mouseenter)="hover.set(p.month)" (mouseleave)="hover.set(null)"
              (focus)="hover.set(p.month)" (blur)="hover.set(null)" [class.active]="hover() === p.month">
              <div class="bars">
                @for (s of series; track s.key) {
                  <span class="bar" [style.height.%]="pct(p[s.key])" [style.background]="s.color"></span>
                }
              </div>
              <span class="mlabel">{{ date(p.month) | date: 'MMM' }}</span>
              @if (hover() === p.month) {
                <span class="tip" role="status">
                  <strong>{{ date(p.month) | date: 'MMM y' }}</strong>
                  @for (s of series; track s.key) {
                    <span>{{ s.label }}: {{ p[s.key] | number }}</span>
                  }
                </span>
              }
            </div>
          }
        </div>
      }
    </figure>
  `,
  styles: `
    .legend { list-style: none; padding: 0; margin: 0 0 var(--an-space-3); display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 0.82rem; color: var(--an-text-2); }
    .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
    .plot { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; align-items: end; height: 220px; padding-top: 8px;
      border-bottom: 1px solid var(--an-border); }
    .col-group { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; outline-offset: 2px; border-radius: 6px; }
    .col-group.active { background: var(--an-navy-50); }
    .bars { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
    .bar { display: block; width: 28%; max-width: 12px; min-height: 2px; border-radius: 3px 3px 0 0; transition: height 400ms var(--an-ease); }
    .mlabel { font-size: 0.7rem; color: var(--an-text-muted); padding: 4px 0 2px; }
    .tip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); z-index: 2; display: flex; flex-direction: column;
      background: var(--an-navy-900); color: #fff; padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; white-space: nowrap; pointer-events: none; }
    @media (max-width: 575.98px) { .mlabel { font-size: 0.6rem; } .bar { width: 30%; } }
  `,
})
export class MonthlyChartComponent {
  readonly title = input('Last 12 months');
  readonly points = input<MonthlyPoint[]>([]);
  protected readonly series = SERIES;
  protected readonly table = signal(false);
  protected readonly hover = signal<string | null>(null);
  private readonly max = computed(() => Math.max(1, ...this.points().flatMap((p) => [p.candidates, p.submissions, p.placements])));
  protected readonly summary = computed(() => {
    const t = this.points().reduce(
      (acc, p) => ({ c: acc.c + p.candidates, s: acc.s + p.submissions, p: acc.p + p.placements }),
      { c: 0, s: 0, p: 0 },
    );
    return `${this.title()}: ${t.c} new candidates, ${t.s} submissions, ${t.p} placements.`;
  });

  pct(v: number): number {
    return (v / this.max()) * 100;
  }

  date(m: string): Date {
    return monthDate(m);
  }

  monthLabel(p: MonthlyPoint): string {
    return `${p.month}: ${p.candidates} candidates, ${p.submissions} submissions, ${p.placements} placements`;
  }
}

export interface FunnelStep {
  label: string;
  value: number;
  icon: string;
}

/** Horizontal tapered funnel with stage-to-stage conversion. */
@Component({
  selector: 'app-funnel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <ol class="funnel" [attr.aria-label]="label()">
      @for (s of steps(); track s.label; let i = $index; let first = $first) {
        <li class="step">
          <div class="bar-wrap"><span class="bar" [style.width.%]="width(s.value)"></span></div>
          <div class="meta">
            <span class="name"><i [class]="'bi ' + s.icon" aria-hidden="true"></i> {{ s.label }}</span>
            <span class="val">{{ s.value | number }}</span>
            @if (!first) {
              <span class="conv" [title]="'Conversion from the previous stage'">{{ conversion(i) }}</span>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .funnel { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .bar-wrap { height: 12px; background: var(--an-surface-2); border-radius: 999px; overflow: hidden; }
    .bar { display: block; height: 100%; min-width: 4px; border-radius: 999px; background: linear-gradient(90deg, var(--an-navy-900), var(--an-navy-600)); }
    .step:last-child .bar { background: linear-gradient(90deg, var(--an-success), #3aa36f); }
    .meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 4px; font-size: 0.86rem; }
    .name { color: var(--an-text-2); flex: 1 1 auto; min-width: 0; }
    .name .bi { color: var(--an-gold-600); }
    .val { font-weight: 700; color: var(--an-navy-900); font-variant-numeric: tabular-nums; }
    .conv { font-size: 0.75rem; color: var(--an-accent-ink); background: var(--an-gold-100); border-radius: 999px; padding: 0 8px; }
  `,
})
export class FunnelComponent {
  readonly steps = input<FunnelStep[]>([]);
  readonly label = input('Recruitment funnel');
  private readonly max = computed(() => Math.max(1, ...this.steps().map((s) => s.value)));

  width(v: number): number {
    return Math.max(2, (v / this.max()) * 100);
  }

  conversion(i: number): string {
    const prev = this.steps()[i - 1]?.value ?? 0;
    const cur = this.steps()[i]?.value ?? 0;
    return prev > 0 ? `${Math.round((cur / prev) * 100)}%` : '—';
  }
}

/** Circular match-score indicator (0–100). */
@Component({
  selector: 'app-score-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ring" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="'Match score ' + score() + '%'">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" class="track" />
        <circle cx="18" cy="18" r="15.5" class="value" [attr.stroke]="color()" [attr.stroke-dasharray]="dash()" />
      </svg>
      <span class="num">{{ score() }}<small>%</small></span>
    </span>
  `,
  styles: `
    .ring { position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    circle { fill: none; stroke-width: 3.5; }
    .track { stroke: var(--an-surface-2); }
    .value { stroke-linecap: round; transition: stroke-dasharray 500ms var(--an-ease); }
    .num { font-weight: 800; font-size: 0.82rem; color: var(--an-navy-900); }
    small { font-size: 0.6rem; font-weight: 600; }
  `,
})
export class ScoreRingComponent {
  readonly score = input(0);
  readonly size = input(48);
  protected readonly dash = computed(() => {
    const c = 2 * Math.PI * 15.5;
    const v = Math.max(0, Math.min(100, this.score()));
    return `${(v / 100) * c} ${c}`;
  });
  protected readonly color = computed(() => (this.score() >= 75 ? '#146C43' : this.score() >= 50 ? '#F7821B' : '#B42318'));
}
