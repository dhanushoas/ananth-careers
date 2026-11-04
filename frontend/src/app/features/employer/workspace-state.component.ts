import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompanyContextService } from './company-context.service';

/** Banner for companies not yet verified by Veejee Services (requirements cannot go live). */
@Component({
  selector: 'app-verification-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (ctx.employer(); as e) {
      @if (e.verificationStatus === 'pending') {
        <div class="alert alert-warning d-flex gap-3 align-items-start verify" role="status">
          <span class="ico"><i class="bi bi-hourglass-split" aria-hidden="true"></i></span>
          <div>
            <strong>Company verification pending.</strong>
            <p class="mb-0">Veejee Services is verifying {{ e.companyName }}. You can prepare requirements as drafts meanwhile; they can be submitted for approval once your company is verified.</p>
          </div>
        </div>
      } @else if (e.verificationStatus === 'rejected') {
        <div class="alert alert-danger d-flex gap-3 align-items-start verify" role="alert">
          <span class="ico"><i class="bi bi-exclamation-octagon" aria-hidden="true"></i></span>
          <div>
            <strong>Company verification was not approved.</strong>
            <p class="mb-0">{{ e.rejectionReason || 'Please review your company details.' }} Requirements cannot go live until your company is verified.
              <a routerLink="/employer/company" class="alert-link">Update company profile</a>
            </p>
          </div>
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .verify { margin-bottom: var(--an-space-4); border-radius: var(--an-radius); }
    .ico { flex: none; width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: rgba(255, 255, 255, 0.6); font-size: 1.2rem; }
  `,
})
export class VerificationBannerComponent {
  protected readonly ctx = inject(CompanyContextService);
}
