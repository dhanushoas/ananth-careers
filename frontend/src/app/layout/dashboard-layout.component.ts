import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { Role } from '../core/models';
import { biIcon } from '../shared/ui/icons';
import { OffcanvasComponent } from '../shared/ui/offcanvas.component';
import { BrandLogoComponent } from './brand-logo.component';
import { NotificationBellComponent } from './notification-bell.component';
import { UserMenuComponent } from './user-menu.component';

export interface NavItem {
  label: string;
  /** Bootstrap icon class (`bi-…`); legacy Material names are mapped. */
  icon: string;
  link: string;
  exact?: boolean;
  /** Only shown to these roles (e.g. employer-only pages in the shared employer area). */
  roles?: Role[];
  /** Only shown to admins holding this permission. */
  permission?: string;
}

export interface DashboardLayoutData {
  nav: NavItem[];
  areaLabel: string;
  variant?: 'default' | 'admin';
}

/**
 * Authenticated workspace shell: sticky top bar + sidebar that is static at ≥lg and an
 * offcanvas drawer below. Navigation comes from the route's `data` ({@link DashboardLayoutData}).
 */
@Component({
  selector: 'app-dashboard-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, OffcanvasComponent, BrandLogoComponent, NotificationBellComponent, UserMenuComponent],
  template: `
    <a class="skip-link" href="#dash-main">Skip to main content</a>
    <div class="shell" [class.admin]="variant() === 'admin'">
      <app-offcanvas
        [(open)]="navOpen"
        responsive="lg"
        placement="start"
        [label]="areaLabel() + ' navigation'"
        panelClass="sidebar"
        bodyClass="d-flex flex-column p-0"
      >
        <span offcanvasTitle class="fw-bold">{{ areaLabel() }}</span>
        <div class="side-head d-none d-lg-flex">
          <app-brand-logo [light]="variant() === 'admin'" [showTagline]="false" />
          <span class="area">{{ areaLabel() }}</span>
        </div>
        <nav class="side-nav" [attr.aria-label]="areaLabel()">
          @for (item of navItems(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
               ariaCurrentWhenActive="page" class="side-link">
              <i [class]="'bi ' + iconOf(item)" aria-hidden="true"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="side-foot">
          <svg class="side-art" viewBox="0 0 200 60" aria-hidden="true">
            <circle cx="170" cy="14" r="26" fill="#F7821B" opacity=".14" />
            <circle cx="24" cy="54" r="30" fill="#1D4380" opacity=".12" />
          </svg>
          <a routerLink="/" class="side-link minor"><i class="bi bi-globe2" aria-hidden="true"></i>Public site</a>
        </div>
      </app-offcanvas>

      <div class="content">
        <header class="topbar">
          <button type="button" class="btn btn-light btn-icon d-lg-none" (click)="navOpen.set(true)" aria-label="Open navigation" [attr.aria-expanded]="navOpen()">
            <i class="bi bi-list fs-4" aria-hidden="true"></i>
          </button>
          <span class="d-lg-none"><app-brand-logo [showTagline]="false" /></span>
          <span class="flex-grow-1"></span>
          <app-notification-bell />
          <app-user-menu />
        </header>
        <main id="dash-main" class="main" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .shell { display: flex; min-height: 100vh; min-height: 100dvh; background: var(--an-bg); }
    :host ::ng-deep .sidebar { --bs-offcanvas-width: 272px; background: var(--an-surface); border-right: 1px solid var(--an-border); }
    @media (min-width: 992px) {
      :host ::ng-deep .sidebar { position: sticky; top: 0; height: 100vh; width: 272px; flex: none; overflow-y: auto; display: flex; flex-direction: column; }
      :host ::ng-deep .sidebar .offcanvas-body { flex: 1; overflow: visible; }
    }
    .side-head { flex-direction: column; gap: 6px; padding: var(--an-space-4) var(--an-space-4) var(--an-space-3); }
    .area { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--an-accent-ink); }
    .side-nav { display: flex; flex-direction: column; gap: 2px; padding: var(--an-space-2); flex: 1; }
    .side-link {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px; min-height: 44px; border-radius: 10px; color: var(--an-text-2);
      text-decoration: none; font-weight: 500; font-size: 0.94rem; transition: background var(--an-dur) var(--an-ease), color var(--an-dur) var(--an-ease);
    }
    .side-link .bi { font-size: 1.15rem; width: 1.25rem; text-align: center; }
    .side-link:hover { background: var(--an-navy-50); color: var(--an-navy-900); }
    .side-link.active { background: linear-gradient(120deg, var(--an-navy-900), var(--an-navy-700)); color: #fff; box-shadow: var(--an-shadow-2); }
    .side-link.active .bi { color: var(--an-gold-300); }
    .side-foot { position: relative; padding: var(--an-space-2); border-top: 1px solid var(--an-border); }
    .side-art { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .minor { font-size: 0.88rem; }
    .admin :host ::ng-deep .sidebar, .admin ::ng-deep .sidebar { background: var(--an-navy-950); border-right-color: var(--an-navy-800); color: var(--an-on-dark-2); }
    .admin ::ng-deep .sidebar .btn-close { filter: invert(1); }
    .admin .side-link { color: var(--an-on-dark-2); }
    .admin .side-link:hover { background: var(--an-navy-800); color: #fff; }
    .admin .side-link.active { background: var(--an-gold-500); color: var(--an-navy-950); }
    .admin .side-link.active .bi { color: var(--an-navy-950); }
    .admin .side-foot { border-top-color: var(--an-navy-800); }
    .admin .area { color: var(--an-gold-300); }
    .content { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .topbar {
      position: sticky; top: 0; z-index: 1020; display: flex; align-items: center; gap: var(--an-space-2);
      height: 64px; padding-inline: var(--an-gutter); background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px); border-bottom: 1px solid var(--an-border);
    }
    .main { padding: var(--an-space-5) var(--an-gutter) var(--an-space-7); max-width: 1320px; width: 100%; outline: none; min-width: 0; }
  `,
})
export class DashboardLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly data = toSignal(this.route.data.pipe(map((d) => d as Partial<DashboardLayoutData>)), {
    initialValue: this.route.snapshot.data as Partial<DashboardLayoutData>,
  });

  protected readonly navOpen = signal(false);
  protected readonly variant = computed(() => this.data().variant ?? 'default');
  protected readonly areaLabel = computed(() => this.data().areaLabel ?? 'Dashboard');
  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return (this.data().nav ?? []).filter(
      (item) =>
        (!item.roles || (role !== null && item.roles.includes(role))) &&
        (!item.permission || this.auth.hasPermission(item.permission)),
    );
  });

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.navOpen.set(false));
  }

  protected iconOf(item: NavItem): string {
    return biIcon(item.icon, 'bi-circle');
  }
}
