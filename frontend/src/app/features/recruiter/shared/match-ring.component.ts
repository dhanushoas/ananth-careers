import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { scoreTone } from './recruiter-utils';

/** Circular match-score ring (0–100). Colour: green ≥75, orange ≥50, slate below. */
@Component({
  selector: 'app-match-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ring" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="'Match score ' + rounded() + ' percent'">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" class="track" />
        <circle cx="22" cy="22" r="18" class="bar" [class]="'bar ' + tone()" [attr.stroke-dasharray]="dash()" transform="rotate(-90 22 22)" />
      </svg>
      <span class="val" [style.font-size.px]="size() * 0.28">{{ rounded() }}<small>%</small></span>
    </span>
  `,
  styles: `
    .ring { position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    circle { fill: none; stroke-width: 4.5; }
    .track { stroke: var(--an-border); }
    .bar { stroke-linecap: round; transition: stroke-dasharray 600ms var(--an-ease); }
    .high { stroke: var(--an-success); }
    .mid { stroke: var(--an-gold-500); }
    .low { stroke: var(--an-neutral); }
    .val { position: relative; font-weight: 800; color: var(--an-navy-900); font-family: var(--an-font-heading); }
    small { font-size: 0.6em; font-weight: 700; }
  `,
})
export class MatchRingComponent {
  readonly score = input.required<number>();
  readonly size = input(56);

  protected readonly rounded = computed(() => Math.round(Math.max(0, Math.min(100, this.score()))));
  protected readonly tone = computed(() => scoreTone(this.rounded()));
  protected readonly dash = computed(() => {
    const c = 2 * Math.PI * 18;
    return `${(c * this.rounded()) / 100} ${c}`;
  });
}
