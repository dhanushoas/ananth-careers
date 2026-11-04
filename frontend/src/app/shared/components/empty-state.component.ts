import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IllustrationComponent, IllustrationName } from '../illustrations/illustration.component';

/** Friendly empty / error state with an original illustration. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IllustrationComponent],
  template: `
    <section class="empty card" [class.compact]="compact()" [class.error]="tone() === 'error'" [attr.role]="tone() === 'error' ? 'alert' : null">
      <app-illustration class="art" [name]="art()" />
      <h2 class="title">{{ title() }}</h2>
      @if (message()) {
        <p class="message">{{ message() }}</p>
      }
      <div class="actions"><ng-content /></div>
    </section>
  `,
  styles: `
    .empty {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: var(--an-space-6) var(--an-space-4); border: 1px dashed var(--an-border-strong);
      background: radial-gradient(circle at 50% 0%, var(--an-navy-50) 0, var(--an-surface) 60%);
    }
    .empty.compact { padding: var(--an-space-4); }
    .art { width: min(200px, 60%); }
    .compact .art { width: min(130px, 45%); }
    .title { font-size: 1.12rem; margin: var(--an-space-3) 0 var(--an-space-1); }
    .message { color: var(--an-text-2); max-width: 48ch; margin: 0; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--an-space-2); margin-top: var(--an-space-4); }
    .actions:empty { display: none; }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>();
  /** Illustration to show; defaults to a generic (or error) graphic. */
  readonly illustration = input<IllustrationName>();
  readonly tone = input<'neutral' | 'error'>('neutral');
  readonly compact = input(false);
  /** @deprecated kept for template compatibility; illustrations replace icons. */
  readonly icon = input<string>();

  protected readonly art = computed<IllustrationName>(
    () => this.illustration() ?? (this.tone() === 'error' ? 'error' : 'empty-generic'),
  );
}
