import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IllustrationComponent, IllustrationName } from '../illustrations/illustration.component';
import { SectionDividerComponent } from '../illustrations/section-divider.component';

/**
 * Illustrated banner for public pages: layered navy gradient + dot texture, gold eyebrow,
 * title/subtitle, projected extras (breadcrumb, actions) and an original illustration on the right.
 */
@Component({
  selector: 'app-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IllustrationComponent, SectionDividerComponent],
  template: `
    <section class="page-hero hero-navy">
      <div class="container hero-grid">
        <div class="copy">
          <ng-content select="[heroTop]" />
          @if (eyebrow()) {
            <span class="eyebrow">{{ eyebrow() }}</span>
          }
          <h1 class="title">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="lead-text">{{ subtitle() }}</p>
          }
          <ng-content />
        </div>
        @if (illustration(); as art) {
          <app-illustration class="art" [class.d-none]="hideArtOnMobile()" [class.d-md-block]="hideArtOnMobile()" [name]="art" />
        }
      </div>
      <app-section-divider [color]="dividerColor()" variant="curve" />
    </section>
  `,
  styles: `
    .page-hero { position: relative; padding-top: var(--an-space-6); }
    .hero-grid { display: grid; gap: var(--an-space-4); align-items: center; grid-template-columns: minmax(0, 1fr); padding-bottom: var(--an-space-3); }
    @media (min-width: 768px) { .hero-grid { grid-template-columns: minmax(0, 1fr) clamp(180px, 26vw, 300px); } }
    .eyebrow { color: var(--an-gold-300); }
    .title { color: #fff; margin: 0; overflow-wrap: anywhere; font-size: clamp(1.6rem, 1.2rem + 1.8vw, 2.6rem); }
    .lead-text { color: var(--an-on-dark-2); margin: var(--an-space-3) 0 0; max-width: 62ch; font-size: 1.05rem; }
    .art { width: min(240px, 70%); justify-self: center; }
    @media (min-width: 768px) { .art { width: 100%; } }
    app-section-divider { display: block; margin-top: var(--an-space-2); }
  `,
})
export class PageHeroComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly eyebrow = input<string>();
  readonly illustration = input<IllustrationName>();
  /** Colour of the section below (the divider blends into it). */
  readonly dividerColor = input('#f6f8fb');
  readonly hideArtOnMobile = input(true);
}
