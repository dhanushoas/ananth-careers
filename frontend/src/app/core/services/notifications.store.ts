import { Injectable, effect, inject, signal } from '@angular/core';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotificationsApiService } from './account.service';

/** Polls the unread notification count every 60 s while signed in. */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(NotificationsApiService);
  private readonly auth = inject(AuthService);
  private poll?: Subscription;

  readonly unreadCount = signal(0);

  constructor() {
    effect(() => {
      const authed = this.auth.isAuthenticated();
      this.poll?.unsubscribe();
      this.poll = undefined;
      if (!authed) {
        this.unreadCount.set(0);
        return;
      }
      this.poll = timer(0, environment.notificationPollMs)
        .pipe(switchMap(() => this.api.unreadCount().pipe(catchError(() => of(null)))))
        .subscribe((count) => {
          if (count !== null) {
            this.unreadCount.set(count);
          }
        });
    });
  }

  /** Re-fetch immediately (after marking read etc.). */
  refresh(): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }
    this.api
      .unreadCount()
      .pipe(catchError(() => of(null)))
      .subscribe((count) => {
        if (count !== null) {
          this.unreadCount.set(count);
        }
      });
  }

  decrement(): void {
    this.unreadCount.update((n) => Math.max(0, n - 1));
  }

  clear(): void {
    this.unreadCount.set(0);
  }
}
