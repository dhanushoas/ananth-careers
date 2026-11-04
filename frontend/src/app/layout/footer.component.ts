import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from './brand-logo.component';
import { SectionDividerComponent } from '../shared/illustrations/section-divider.component';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandLogoComponent, SectionDividerComponent],
  template: `
    <app-section-divider variant="wave" color="#0A1F44" />
    <footer class="footer bg-dots-light">
      <div class="container grid">
        <div class="about">
          <app-brand-logo [light]="true" [height]="48" />
          <p class="tagline">Your Recruitment Partner</p>
          <p class="blurb">
            Veejee Services is a recruitment consultancy. Candidates register with us, our recruiters screen and
            shortlist them, and we share profiles with client companies only with the candidate’s consent.
          </p>
          <ul class="contact-list">
            <li><i class="bi bi-envelope" aria-hidden="true"></i><a routerLink="/contact">Send us an enquiry</a></li>
            <li><i class="bi bi-shield-check" aria-hidden="true"></i><span>Profiles shared only with your consent</span></li>
            <li><i class="bi bi-lock" aria-hidden="true"></i><span>Encrypted resume storage</span></li>
          </ul>
        </div>
        <nav aria-label="Job seekers" class="col">
          <h2>Job seekers</h2>
          <a routerLink="/jobs">Job opportunities</a>
          <a routerLink="/job-seekers">For job seekers</a>
          <a routerLink="/auth/register/candidate">Register with us</a>
          <a routerLink="/candidate/applications">My applications</a>
        </nav>
        <nav aria-label="Employers" class="col">
          <h2>Employers</h2>
          <a routerLink="/for-employers">For employers</a>
          <a routerLink="/auth/register/employer">Register your company</a>
          <a routerLink="/employer/requirements">Post a requirement</a>
          <a routerLink="/employers">Client companies</a>
        </nav>
        <nav aria-label="Company" class="col">
          <h2>Veejee Services</h2>
          <a routerLink="/about">About us</a>
          <a routerLink="/services">Our services</a>
          <a routerLink="/process">How our process works</a>
          <a routerLink="/industries">Industries we serve</a>
          <a routerLink="/faq">FAQ</a>
          <a routerLink="/contact">Contact</a>
        </nav>
      </div>
      <div class="container legal">
        <p>© {{ year }} Veejee Services – Your Recruitment Partner. All rights reserved.</p>
        <nav aria-label="Legal" class="legal-links">
          <a routerLink="/privacy">Privacy policy</a>
          <a routerLink="/terms">Terms of use</a>
          <a routerLink="/refund">Refund policy</a>
        </nav>
      </div>
    </footer>
  `,
  styles: `
    :host { display: block; margin-top: auto; }
    app-section-divider { display: block; margin-bottom: -1px; }
    .contact-list { list-style: none; padding: 0; margin: var(--an-space-3) 0 0; display: grid; gap: 8px; font-size: 0.9rem; }
    .contact-list .bi { color: var(--an-gold-300); margin-right: 8px; }
    .footer { background-color: var(--an-navy-950); color: var(--an-on-dark-2); padding-top: var(--an-space-6); }
    .grid { display: grid; gap: var(--an-space-6); grid-template-columns: 1fr; padding-bottom: var(--an-space-6); }
    @media (min-width: 600px) { .grid { grid-template-columns: repeat(3, 1fr); } .about { grid-column: 1 / -1; } }
    @media (min-width: 1024px) { .grid { grid-template-columns: 2fr 1fr 1fr 1fr; } .about { grid-column: auto; } }
    .tagline { color: var(--an-gold-300); font-family: var(--an-font-heading); font-weight: 600; margin: var(--an-space-3) 0 var(--an-space-2); }
    .blurb { font-size: 0.92rem; max-width: 44ch; }
    h2 { color: #fff; font-size: 0.95rem; margin-bottom: var(--an-space-3); letter-spacing: 0.02em; }
    .col { display: flex; flex-direction: column; gap: 10px; }
    a { color: var(--an-on-dark-2); text-decoration: none; font-size: 0.92rem; }
    a:hover { color: #fff; text-decoration: underline; }
    .legal { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--an-space-3); padding-block: var(--an-space-4);
      border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.84rem; }
    .legal p { margin: 0; }
    .legal-links { display: flex; flex-wrap: wrap; gap: var(--an-space-4); }
  `,
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
