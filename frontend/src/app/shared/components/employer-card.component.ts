import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmployerPublic } from '../../core/models';
import { CompanyLogoComponent } from './company-logo.component';

@Component({
  selector: 'app-employer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CompanyLogoComponent],
  template: `
    @let e = employer();
    <a class="emp card card-hover h-100" [routerLink]="['/employers', e.slug]" data-testid="employer-card">
      <span class="band" aria-hidden="true"></span>
      <span class="body">
        <app-company-logo class="logo" [employerId]="e.id" [hasLogo]="e.hasLogo" [name]="e.companyName" [size]="56" />
        <span class="name">{{ e.companyName }} <i class="bi bi-patch-check-fill verified" aria-label="Verified client company"></i></span>
        @if (e.industry; as ind) {
          <span class="meta"><i class="bi bi-grid" aria-hidden="true"></i>{{ ind.name }}</span>
        }
        @if (e.headquarters) {
          <span class="meta"><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ e.headquarters }}</span>
        }
        <span class="foot">
          @if (e.featured) {
            <span class="badge text-bg-gold"><i class="bi bi-star-fill" aria-hidden="true"></i> Featured</span>
          }
          @if (e.jobCount !== undefined) {
            <span class="jobs">{{ e.jobCount }} open {{ e.jobCount === 1 ? 'job' : 'jobs' }}</span>
          }
        </span>
      </span>
    </a>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .emp { overflow: hidden; text-decoration: none; color: var(--an-text); }
    .band { display: block; height: 44px; background: linear-gradient(120deg, var(--an-navy-900), var(--an-navy-600));
      background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1.4px), linear-gradient(120deg, var(--an-navy-900), var(--an-navy-600));
      background-size: 12px 12px, auto; }
    .body { display: flex; flex-direction: column; gap: 4px; padding: 0 var(--an-space-4) var(--an-space-4); min-width: 0; }
    .logo { margin-top: -28px; margin-bottom: var(--an-space-2); border: 3px solid #fff; border-radius: 14px; width: fit-content; box-shadow: var(--an-shadow-1); }
    .name { font-family: var(--an-font-heading); font-weight: 700; color: var(--an-navy-900); overflow-wrap: anywhere; }
    .verified { color: var(--an-info); font-size: 0.95rem; }
    .meta { font-size: 0.86rem; color: var(--an-text-2); display: inline-flex; align-items: center; gap: 6px; }
    .foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--an-space-2); margin-top: auto; padding-top: var(--an-space-2); }
    .jobs { font-size: 0.82rem; color: var(--an-accent-ink); font-weight: 700; }
  `,
})
export class EmployerCardComponent {
  readonly employer = input.required<EmployerPublic>();
}
