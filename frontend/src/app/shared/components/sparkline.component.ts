import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const W = 100;
const H = 32;
const PAD = 2;

let seq = 0;

/** Tiny decorative trend line / bars for stat cards (aria-hidden; the number is the content). */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @if (values().length) {
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" focusable="false">
        @if (variant() === 'bars') {
          @for (b of bars(); track $index) {
            <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="1.5" [attr.fill]="color()" [attr.opacity]="$last ? 1 : 0.55" />
          }
        } @else {
          <defs>
            <linearGradient [attr.id]="gid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" [attr.stop-color]="color()" stop-opacity="0.25" />
              <stop offset="1" [attr.stop-color]="color()" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path [attr.d]="area()" [attr.fill]="'url(#' + gid + ')'" />
          <path [attr.d]="line()" fill="none" [attr.stroke]="color()" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
        }
      </svg>
    }
  `,
  styles: `:host { display: block; width: 100px; max-width: 100%; height: 32px; } svg { display: block; width: 100%; height: 100%; }`,
})
export class SparklineComponent {
  readonly values = input<number[]>([]);
  readonly variant = input<'line' | 'bars'>('line');
  readonly color = input('#1D4380');

  protected readonly w = W;
  protected readonly h = H;
  protected readonly gid = `spk-${++seq}`;

  private readonly points = computed(() => {
    const v = this.values();
    const max = Math.max(1, ...v);
    const min = Math.min(0, ...v);
    const span = max - min || 1;
    const n = Math.max(1, v.length - 1);
    return v.map((val, i) => ({
      x: v.length === 1 ? W / 2 : PAD + (i / n) * (W - PAD * 2),
      y: PAD + (1 - (val - min) / span) * (H - PAD * 2),
    }));
  });

  protected readonly line = computed(() =>
    this.points()
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly area = computed(() => {
    const p = this.points();
    if (!p.length) return '';
    return `${this.line()} L${p[p.length - 1].x.toFixed(1)},${H} L${p[0].x.toFixed(1)},${H} Z`;
  });

  protected readonly bars = computed(() => {
    const v = this.values();
    const max = Math.max(1, ...v);
    const slot = W / v.length;
    const bw = Math.max(2, slot - 3);
    return v.map((val, i) => {
      const h = Math.max(1.5, (Math.max(0, val) / max) * (H - PAD));
      return { x: i * slot + (slot - bw) / 2, y: H - h, w: bw, h };
    });
  });
}
