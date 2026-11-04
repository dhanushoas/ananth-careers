import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IllustrationComponent, IllustrationName } from '../../shared/illustrations/illustration.component';

/**
 * Split auth layout: illustrated navy panel (≥lg) + form card. On smaller screens a compact
 * illustrated navy header sits above the card instead of the side panel.
 */
@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IllustrationComponent],
  template: `
    <section class="shell">
      <aside class="side hero-navy d-none d-lg-flex">
        <app-illustration class="side-art float-slow" [name]="art()" />
        <p class="quote">{{ panelTitle() }}</p>
        <ul class="points">
          @for (p of points(); track p) {
            <li><i class="bi bi-check-circle-fill" aria-hidden="true"></i>{{ p }}</li>
          }
        </ul>
      </aside>
      <div class="panel bg-dots">
        <div class="mobile-head hero-navy d-lg-none">
          <app-illustration class="mobile-art" [name]="art()" />
          <p class="m-0 fw-semibold">{{ panelTitle() }}</p>
        </div>
        <div class="card form-card fade-in">
          <div class="card-body">
            <h1 class="title">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="subtitle">{{ subtitle() }}</p>
            }
            <ng-content />
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: minmax(0, 1fr); min-height: calc(100vh - var(--an-header-h)); }
    @media (min-width: 992px) { .shell { grid-template-columns: 5fr 7fr; } }
    .side { flex-direction: column; justify-content: center; padding: var(--an-space-8) var(--an-space-7); }
    .side-art { width: 100%; max-width: 380px; }
    .quote { font-family: var(--an-font-heading); font-size: 1.7rem; font-weight: 800; line-height: 1.2; margin: var(--an-space-5) 0 var(--an-space-4); color: #fff; }
    .points { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; color: var(--an-on-dark-2); }
    .points .bi { color: var(--an-gold-300); margin-right: 8px; }
    .panel { display: flex; flex-direction: column; align-items: center; padding: var(--an-space-5) var(--an-gutter) var(--an-space-7); }
    @media (min-width: 992px) { .panel { justify-content: center; padding-block: var(--an-space-7); } }
    .mobile-head { display: flex; align-items: center; gap: var(--an-space-3); width: 100%; max-width: 600px; border-radius: var(--an-radius-lg);
      padding: var(--an-space-3) var(--an-space-4); margin-bottom: calc(-1 * var(--an-space-4)); padding-bottom: var(--an-space-6); }
    .mobile-art { width: 96px; flex: none; }
    .form-card { width: 100%; max-width: 600px; border-radius: var(--an-radius-xl); box-shadow: var(--an-shadow-3); position: relative; }
    .form-card > .card-body { padding: var(--an-space-6) var(--an-space-5); }
    @media (max-width: 575.98px) { .form-card > .card-body { padding: var(--an-space-5) var(--an-space-4); } }
    .title { font-size: 1.6rem; margin-bottom: var(--an-space-1); }
    .subtitle { color: var(--an-text-2); margin-bottom: var(--an-space-4); }
  `,
})
export class AuthShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly art = input<IllustrationName>('auth-login');
  readonly panelTitle = input('Your Recruitment Partner.');
  readonly points = input<string[]>([
    'Recruiters who screen and shortlist for you',
    'Profiles shared only with candidate consent',
    'Interviews coordinated through to placement',
  ]);
}
