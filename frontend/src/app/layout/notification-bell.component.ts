import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { NotificationsApiService } from '../core/services/account.service';
import { NotificationsStore } from '../core/services/notifications.store';
import { AppNotification } from '../core/models';
import { TimeAgoPipe } from '../shared/pipes/time-ago.pipe';
import { DropdownComponent } from '../shared/ui/dropdown.component';

@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeAgoPipe, DropdownComponent],
  template: `
    <app-dropdown
      align="end"
      buttonClass="btn btn-light btn-icon position-relative bell"
      [ariaLabel]="'Notifications, ' + store.unreadCount() + ' unread'"
      menuWidth="min(340px, calc(100vw - 24px))"
      testId="notification-bell"
      (click)="onToggleClick($event)"
    >
      <ng-container toggle>
        <i class="bi bi-bell" aria-hidden="true"></i>
        @if (store.unreadCount() > 0) {
          <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger count" aria-hidden="true">
            {{ store.unreadCount() > 99 ? '99+' : store.unreadCount() }}
          </span>
        }
      </ng-container>
      <div class="d-flex align-items-center justify-content-between px-3 py-2 gap-2">
        <strong>Notifications</strong>
        @if (store.unreadCount() > 0) {
          <button type="button" class="btn btn-link btn-sm p-0" (click)="markAll($event)">Mark all read</button>
        }
      </div>
      <hr class="dropdown-divider" />
      @if (loading() && !items().length) {
        <div class="px-3 py-2 text-secondary small"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading…</div>
      }
      @for (n of items(); track n.id) {
        <button type="button" class="dropdown-item notif" [class.unread]="!n.readAt" (click)="open(n)">
          <span class="dot" aria-hidden="true"></span>
          <span class="d-flex flex-column">
            <span class="fw-semibold">{{ n.title }}</span>
            <span class="small text-secondary">{{ n.message }}</span>
            <span class="small text-body-tertiary">{{ n.createdAt | timeAgo }}</span>
          </span>
        </button>
      } @empty {
        @if (!loading()) {
          <div class="px-3 py-3 text-secondary small text-center"><i class="bi bi-check2-all d-block fs-4 text-gold" aria-hidden="true"></i>You're all caught up.</div>
        }
      }
      <hr class="dropdown-divider" />
      <a class="dropdown-item justify-content-center fw-semibold" routerLink="/notifications">View all notifications</a>
    </app-dropdown>
  `,
  styles: `
    :host { display: inline-flex; }
    .count { font-size: 0.65rem; }
    .notif { align-items: flex-start; }
    .notif .dot { flex: none; width: 8px; height: 8px; margin-top: 7px; border-radius: 50%; background: transparent; }
    .notif.unread .dot { background: var(--an-gold-500); }
    .notif.unread { background: var(--an-gold-100); }
  `,
})
export class NotificationBellComponent {
  protected readonly store = inject(NotificationsStore);
  private readonly api = inject(NotificationsApiService);
  private readonly router = inject(Router);
  protected readonly items = signal<AppNotification[]>([]);
  protected readonly loading = signal(false);
  private lastLoad = 0;

  onToggleClick(event: MouseEvent): void {
    // Load when the toggle button (not a menu item) is clicked, at most every 5 s.
    const target = event.target as HTMLElement;
    if (target.closest('.dropdown-menu') || Date.now() - this.lastLoad < 5000) {
      return;
    }
    this.lastLoad = Date.now();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list({ limit: 8 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((page) => this.items.set(page.items));
    this.store.refresh();
  }

  markAll(event: Event): void {
    event.stopPropagation();
    this.api.markAllRead().subscribe(() => {
      this.store.clear();
      const now = new Date().toISOString();
      this.items.update((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    });
  }

  open(n: AppNotification): void {
    if (!n.readAt) {
      this.api.markRead(n.id).subscribe(() => this.store.decrement());
    }
    if (n.link && /^https?:\/\//.test(n.link)) {
      window.location.assign(n.link);
    } else {
      void this.router.navigateByUrl(n.link || '/notifications');
    }
  }
}
