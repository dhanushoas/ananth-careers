import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IllustrationComponent, IllustrationName } from '../illustrations/illustration.component';

/** Workspace page header: soft navy→gold band, gold accent bar, optional illustration (hidden on phones). */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IllustrationComponent],
  template: `
    <header class="page-header">
      <div class="text">
        @if (eyebrow()) {
          <span class="eyebrow">{{ eyebrow() }}</span>
        }
        <h1 class="title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
        <div class="actions"><ng-content /></div>
      </div>
      @if (illustration(); as art) {
        <app-illustration class="art d-none d-md-block" [name]="art" />
      }
    </header>
  `,
  styles: `
    .page-header {
      position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between;
      gap: var(--an-space-4); padding: var(--an-space-5); margin-bottom: var(--an-space-5);
      border-radius: var(--an-radius-lg); border: 1px solid var(--an-border); box-shadow: var(--an-shadow-1);
      background:
        radial-gradient(circle at 100% 0%, rgba(247, 130, 27, 0.16) 0, transparent 36%),
        radial-gradient(circle at 0% 100%, rgba(11, 42, 91, 0.06) 0, transparent 40%),
        linear-gradient(120deg, rgba(11, 42, 91, 0.06) 0%, rgba(11, 42, 91, 0.015) 60%, transparent 100%),
        var(--an-surface);
    }
    .page-header::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
      background: linear-gradient(180deg, var(--an-gold-500), var(--an-gold-300));
    }
    @media (max-width: 599.98px) { .page-header { padding: var(--an-space-4); } }
    .text { min-width: 0; flex: 1 1 auto; }
    .title { font-size: clamp(1.4rem, 1.1rem + 1vw, 1.9rem); margin: 0; overflow-wrap: anywhere; }
    .subtitle { margin: var(--an-space-2) 0 0; color: var(--an-text-2); max-width: 70ch; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--an-space-2); margin-top: var(--an-space-3); }
    .actions:empty { display: none; }
    .art { flex: 0 0 auto; width: clamp(120px, 16vw, 180px); }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly eyebrow = input<string>();
  readonly illustration = input<IllustrationName>();
}
