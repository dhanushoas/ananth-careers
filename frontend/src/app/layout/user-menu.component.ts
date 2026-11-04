import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { UserAvatarComponent } from '../shared/components/user-avatar.component';
import { EnumLabelPipe } from '../shared/pipes/enum-label.pipe';
import { DropdownComponent } from '../shared/ui/dropdown.component';

@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UserAvatarComponent, EnumLabelPipe, DropdownComponent],
  template: `
    @if (auth.user(); as u) {
      <app-dropdown align="end" buttonClass="btn btn-light trigger" ariaLabel="Account menu" testId="user-menu">
        <ng-container toggle>
          <app-user-avatar [userId]="u.id" [hasAvatar]="u.hasAvatar" [name]="u.name" [size]="32" />
          <span class="name d-none d-sm-inline">{{ firstName() }}</span>
          <i class="bi bi-chevron-down small" aria-hidden="true"></i>
        </ng-container>
        <div class="who px-3 pt-2 pb-2">
          <strong class="d-block text-truncate">{{ u.name }}</strong>
          <span class="d-block small text-secondary text-truncate">{{ u.email }}</span>
          <span class="badge text-bg-gold mt-1">{{ u.role | enumLabel }}</span>
        </div>
        <hr class="dropdown-divider" />
        <a class="dropdown-item" [routerLink]="auth.homeUrl()"><i class="bi bi-speedometer2" aria-hidden="true"></i>Dashboard</a>
        @if (u.role === 'candidate') {
          <a class="dropdown-item" routerLink="/candidate/profile"><i class="bi bi-person-badge" aria-hidden="true"></i>My profile</a>
          <a class="dropdown-item" routerLink="/candidate/applications"><i class="bi bi-clipboard-check" aria-hidden="true"></i>Applications</a>
        }
        @if (u.role === 'admin' && auth.canRecruit()) {
          <a class="dropdown-item" routerLink="/recruiter"><i class="bi bi-person-workspace" aria-hidden="true"></i>Recruiter portal</a>
        }
        <a class="dropdown-item" routerLink="/notifications"><i class="bi bi-bell" aria-hidden="true"></i>Notifications</a>
        <a class="dropdown-item" [routerLink]="u.role === 'admin' ? '/admin/account' : [auth.homeUrl(), 'settings']"><i class="bi bi-gear" aria-hidden="true"></i>Settings</a>
        <hr class="dropdown-divider" />
        <button type="button" class="dropdown-item text-danger" (click)="logout()" data-testid="logout">
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i>Sign out
        </button>
      </app-dropdown>
    }
  `,
  styles: `
    :host ::ng-deep .trigger { gap: 8px; padding-inline: 6px 10px; border-radius: 999px; }
    .name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .who { max-width: 260px; }
  `,
})
export class UserMenuComponent {
  protected readonly auth = inject(AuthService);
  protected readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);

  logout(): void {
    this.auth.logout().subscribe();
  }
}
