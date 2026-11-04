import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PATHS: Record<'wave' | 'curve' | 'slant', string> = {
  wave: 'M0 40C120 72 240 8 360 24s240 48 360 32 240-44 360-24 240 40 360 16V80H0Z',
  curve: 'M0 64C360 0 1080 0 1440 64V80H0Z',
  slant: 'M0 80 1440 8V80Z',
};

/** Full-width SVG wave/curve separating sections. `color` is the fill (the colour of the next section). */
@Component({
  selector: 'app-section-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'section-divider' },
  template: `
    <svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false" [class.flip]="flip()">
      <path [attr.d]="path()" [attr.fill]="color()" />
    </svg>
  `,
  styles: `
    :host { display: block; width: 100%; overflow: hidden; line-height: 0; margin: 0; }
    svg { display: block; width: 100%; height: 48px; }
    @media (min-width: 768px) { svg { height: 72px; } }
    .flip { transform: scaleY(-1); }
  `,
})
export class SectionDividerComponent {
  readonly variant = input<'wave' | 'curve' | 'slant'>('wave');
  readonly color = input('#f6f8fb');
  readonly flip = input(false);
  protected readonly path = computed(() => PATHS[this.variant()] ?? PATHS.wave);
}
