import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { OffcanvasComponent } from '../shared/ui/offcanvas.component';
import { BrandLogoComponent } from './brand-logo.component';
import { NotificationBellComponent } from './notification-bell.component';
import { UserMenuComponent } from './user-menu.component';

export const PUBLIC_NAV = [
  { label: 'Jobs', link: '/jobs', icon: 'bi-search' },
  { label: 'Industries', link: '/industries', icon: 'bi-grid' },
  { label: 'For Job Seekers', link: '/job-seekers', icon: 'bi-person-badge' },
  { label: 'For Employers', link: '/for-employers', icon: 'bi-buildings' },
  { label: 'How It Works', link: '/process', icon: 'bi-diagram-3' },
  { label: 'About', link: '/about', icon: 'bi-info-circle' },
  { label: 'Contact', link: '/contact', icon: 'bi-envelope' },
] as const;

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, OffcanvasComponent, BrandLogoComponent, NotificationBellComponent, UserMenuComponent],
  template: `
    <header class="site-header">
      <nav class="navbar navbar-expand-xxl container" aria-label="Main">
        <app-brand-logo />
        <ul class="navbar-nav d-none d-xxl-flex mx-auto gap-0">
          @for (item of nav; track item.link) {
            <li class="nav-item">
              <a class="nav-link" [routerLink]="item.link" routerLinkActive="active" ariaCurrentWhenActive="page">{{ item.label }}</a>
            </li>
          }
        </ul>
        <div class="d-flex align-items-center gap-1 ms-auto ms-xxl-0">
          @if (auth.isAuthenticated()) {
            <app-notification-bell />
            <app-user-menu />
          } @else {
            <a class="btn btn-link d-none d-sm-inline-flex" routerLink="/auth/login">Sign in</a>
            <a class="btn btn-gold d-none d-sm-inline-flex" routerLink="/auth/register">Register</a>
          }
          <button
            type="button"
            class="btn btn-light btn-icon d-xxl-none"
            (click)="drawerOpen.set(true)"
            aria-label="Open menu"
            aria-controls="mobile-drawer"
            [attr.aria-expanded]="drawerOpen()"
          >
            <i class="bi bi-list fs-4" aria-hidden="true"></i>
          </button>
        </div>
      </nav>
    </header>

    <app-offcanvas [(open)]="drawerOpen" label="Menu" placement="end" panelId="mobile-drawer" panelClass="drawer">
      <app-brand-logo offcanvasTitle [showTagline]="false" />
      <nav aria-label="Mobile" class="d-flex flex-column gap-1">
        <a routerLink="/" class="d-link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-house" aria-hidden="true"></i>Home</a>
        @for (item of nav; track item.link) {
          <a [routerLink]="item.link" class="d-link" routerLinkActive="active"><i [class]="'bi ' + item.icon" aria-hidden="true"></i>{{ item.label }}</a>
        }
        <hr />
        <a routerLink="/services" class="d-link minor" routerLinkActive="active"><i class="bi bi-stars" aria-hidden="true"></i>Our Services</a>
        <a routerLink="/employers" class="d-link minor" routerLinkActive="active"><i class="bi bi-patch-check" aria-hidden="true"></i>Client companies</a>
        <a routerLink="/faq" class="d-link minor" routerLinkActive="active"><i class="bi bi-question-circle" aria-hidden="true"></i>FAQ</a>
      </nav>
      <div class="d-grid gap-2 mt-4">
        @if (auth.isAuthenticated()) {
          <a class="btn btn-primary" [routerLink]="auth.homeUrl()"><i class="bi bi-speedometer2" aria-hidden="true"></i>Go to dashboard</a>
        } @else {
          <a class="btn btn-outline-primary" routerLink="/auth/login">Sign in</a>
          <a class="btn btn-gold" routerLink="/auth/register">Create free account</a>
        }
      </div>
    </app-offcanvas>
  `,
  styles: `
    .site-header {
      position: sticky; top: 0; z-index: 1030; background: rgba(255, 255, 255, 0.94);
      backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--an-border);
    }
    .navbar { min-height: var(--an-header-h); flex-wrap: nowrap; gap: var(--an-space-3); }
    .nav-link { position: relative; padding: 8px 12px !important; border-radius: 8px; color: var(--an-text-2); font-weight: 500; font-size: 0.9rem; white-space: nowrap; }
    .nav-link:hover { color: var(--an-navy-900); background: var(--an-navy-50); }
    .nav-link.active { color: var(--an-navy-900); font-weight: 600; }
    .nav-link.active::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 2px; height: 2px; border-radius: 2px; background: var(--an-gold-500); }
    .d-link { display: flex; align-items: center; gap: 12px; padding: 12px; min-height: 48px; border-radius: 10px; color: var(--an-text); text-decoration: none; font-weight: 500; }
    .d-link .bi { color: var(--an-gold-600); font-size: 1.1rem; }
    .d-link:hover, .d-link.active { background: var(--an-navy-50); color: var(--an-navy-900); }
    .d-link.minor { font-size: 0.94rem; color: var(--an-text-2); }
  `,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly nav = PUBLIC_NAV;
  protected readonly drawerOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.drawerOpen.set(false));
  }
}
