import { HttpContext, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from '../http/api.service';
import { AuthService } from '../auth/auth.service';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { AppNotification, AuthUser, PageQuery, Paginated, Recruiter, UpdateMeRequest } from '../models';

/** /users/me (self-service account) and /recruiters/me. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  updateMe(body: UpdateMeRequest): Observable<AuthUser> {
    return this.api.patch<{ user: AuthUser }>('/users/me', body).pipe(
      map((res) => res.user),
      tap((user) => this.auth.setUser(user)),
    );
  }

  uploadAvatar(file: File): Observable<unknown> {
    return this.api.upload<unknown>('/users/me/avatar', file).pipe(tap(() => this.auth.patchUser({ hasAvatar: true })));
  }

  deleteAvatar(): Observable<unknown> {
    return this.api.delete<unknown>('/users/me/avatar').pipe(tap(() => this.auth.patchUser({ hasAvatar: false })));
  }

  avatar(userId: string): Observable<HttpResponse<Blob>> {
    return this.api.getBlob(`/users/${userId}/avatar`, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) });
  }

  exportData(): Observable<unknown> {
    return this.api.get<unknown>('/users/me/export');
  }

  updateConsent(marketingEmails: boolean): Observable<unknown> {
    return this.api
      .patch<unknown>('/users/me/consent', { marketingEmails })
      .pipe(tap(() => this.auth.patchUser({ marketingEmails })));
  }

  /** Password accounts confirm with their password; Google-only accounts send `{ confirm: 'DELETE' }`. */
  deleteAccount(confirmation: string | { confirm: 'DELETE' }): Observable<unknown> {
    const body = typeof confirmation === 'string' ? { password: confirmation } : confirmation;
    return this.api.delete<unknown>('/users/me', body, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) });
  }

  recruiterProfile(): Observable<Recruiter> {
    return this.api.get<Recruiter>('/recruiters/me');
  }

  updateRecruiterProfile(designation: string): Observable<Recruiter> {
    return this.api.put<Recruiter>('/recruiters/me', { designation });
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly api = inject(ApiService);

  list(query: PageQuery & { unread?: boolean } = {}): Observable<Paginated<AppNotification>> {
    return this.api.get<Paginated<AppNotification>>('/notifications', { params: query });
  }

  unreadCount(): Observable<number> {
    return this.api
      .get<{ count: number }>('/notifications/unread-count', { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .pipe(map((res) => res.count));
  }

  markRead(id: string): Observable<unknown> {
    return this.api.patch<unknown>(`/notifications/${id}/read`);
  }

  markAllRead(): Observable<unknown> {
    return this.api.patch<unknown>('/notifications/read-all');
  }
}
