import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Consent } from '../../core/models';

/** Two badges showing a candidate's profile/contact sharing consent (icon + text, never colour alone). */
@Component({
  selector: 'app-consent-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = consent();
    <span class="d-inline-flex flex-wrap gap-2" data-testid="consent-badges">
      <span class="badge rounded-pill cb" [class.on]="c?.profileSharing" [class.off]="!c?.profileSharing">
        <i [class]="c?.profileSharing ? 'bi bi-check-circle-fill' : 'bi bi-slash-circle'" aria-hidden="true"></i>
        Profile sharing {{ c?.profileSharing ? 'on' : 'off' }}
      </span>
      <span class="badge rounded-pill cb" [class.on]="c?.contactSharing" [class.off]="!c?.contactSharing">
        <i [class]="c?.contactSharing ? 'bi bi-check-circle-fill' : 'bi bi-slash-circle'" aria-hidden="true"></i>
        Contact sharing {{ c?.contactSharing ? 'on' : 'off' }}
      </span>
    </span>
  `,
  styles: `
    .cb { display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; padding: 0.4em 0.8em; border: 1px solid transparent; }
    .on { background: var(--an-success-bg); color: var(--an-success); border-color: #b7e0c7; }
    .off { background: var(--an-neutral-bg); color: var(--an-neutral); border-color: var(--an-border); }
  `,
})
export class ConsentBadgesComponent {
  readonly consent = input<Consent | null | undefined>();
}
