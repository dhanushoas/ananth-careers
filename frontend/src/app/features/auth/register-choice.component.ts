import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { AuthShellComponent } from './auth-shell.component';
import { GoogleSigninComponent } from './google-signin.component';

@Component({
  selector: 'app-register-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleSigninComponent, RouterLink, IllustrationComponent, AuthShellComponent],
  template: `
    <app-auth-shell title="Join Veejee Services" subtitle="Tell us whether you're looking for a job or hiring for your company." art="auth-register">
      <app-google-signin context="signup" />
      <div class="row g-3">
        <div class="col-12 col-sm-6">
          <a routerLink="/auth/register/candidate" class="choice card card-hover h-100" data-testid="choose-candidate">
            <app-illustration name="cta-seeker" class="art" />
            <span class="fw-bold text-navy">I'm a candidate</span>
            <span class="small text-secondary">Register once – our recruiters screen your profile and match you with suitable roles. Free for candidates.</span>
            <span class="go">Register as a candidate <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
          </a>
        </div>
        <div class="col-12 col-sm-6">
          <a routerLink="/auth/register/employer" class="choice card card-hover h-100" data-testid="choose-employer">
            <app-illustration name="cta-employer" class="art" />
            <span class="fw-bold text-navy">I'm hiring</span>
            <span class="small text-secondary">Post your requirements and receive screened, consented candidates from Veejee Services.</span>
            <span class="go">Register your company <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
          </a>
        </div>
      </div>
      <p class="small text-secondary mt-4 mb-2">
        <i class="bi bi-info-circle" aria-hidden="true"></i> Veejee Services recruiters join through an invitation from our team.
      </p>
      <p class="text-center text-secondary mb-0">Already have an account? <a routerLink="/auth/login" class="fw-semibold">Sign in</a></p>
    </app-auth-shell>
  `,
  styles: `
    .choice { display: flex; flex-direction: column; gap: 6px; padding: var(--an-space-4); text-decoration: none; color: var(--an-text); }
    .choice:hover { border-color: var(--an-gold-500); }
    .art { width: 120px; margin-bottom: var(--an-space-2); }
    .text-navy { color: var(--an-navy-900); }
    .go { margin-top: auto; padding-top: var(--an-space-2); font-weight: 600; color: var(--an-navy-700); font-size: 0.9rem; }
  `,
})
export default class RegisterChoiceComponent {}
