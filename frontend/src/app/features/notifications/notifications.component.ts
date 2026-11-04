import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AppNotification, Paginated } from '../../core/models';
import { NotificationsApiService } from '../../core/services/account.service';
import { NotificationsStore } from '../../core/services/notifications.store';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PaginatorComponent,
    TimeAgoPipe,
  ],
  template: `
    <section class="container section">
      <app-page-header title="Notifications" illustration="notifications" subtitle="Updates from Veejee Services about your profile, applications, interviews and account.">
        <ul class="nav nav-pills" role="group" aria-label="Filter notifications">
          <li class="nav-item">
            <button type="button" class="nav-link" [class.active]="!unreadOnly()" [attr.aria-pressed]="!unreadOnly()" (click)="setUnread(false)">All</button>
          </li>
          <li class="nav-item">
            <button type="button" class="nav-link" [class.active]="unreadOnly()" [attr.aria-pressed]="unreadOnly()" (click)="setUnread(true)">
              Unread
              @if (store.unreadCount() > 0) {
                <span class="badge rounded-pill text-bg-gold ms-1">{{ store.unreadCount() }}</span>
              }
            </button>
          </li>
        </ul>
        <button class="btn btn-outline-primary" type="button" (click)="markAll()" [disabled]="markingAll() || store.unreadCount() === 0">
          <i class="bi bi-check2-all" aria-hidden="true"></i> Mark all read
        </button>
      </app-page-header>

      @if (loading() && !page()) {
        <app-skeleton variant="table" [count]="6" />
      } @else if (error()) {
        <app-empty-state tone="error" illustration="error" title="We couldn't load your notifications">
          <button class="btn btn-primary" type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
        </app-empty-state>
      } @else if (page(); as p) {
        @if (p.items.length) {
          <div class="list-group shadow-sm" [class.dim]="loading()">
            @for (n of p.items; track n.id) {
              <button type="button" class="list-group-item list-group-item-action item" [class.unread]="!n.readAt" (click)="open(n)">
                <span class="ic" aria-hidden="true"><i [class]="'bi ' + iconFor(n.type)"></i></span>
                <span class="body">
                  <span class="title">
                    @if (!n.readAt) {
                      <span class="dot" aria-hidden="true"></span>
                    }
                    {{ n.title }}<span class="visually-hidden">{{ n.readAt ? '' : ' (unread)' }}</span>
                  </span>
                  <span class="msg">{{ n.message }}</span>
                  <time class="time" [attr.datetime]="n.createdAt" [title]="n.createdAt | date: 'medium'">
                    <i class="bi bi-clock" aria-hidden="true"></i> {{ n.createdAt | timeAgo }}
                  </time>
                </span>
                @if (n.link) {
                  <i class="bi bi-chevron-right chev" aria-hidden="true"></i>
                }
              </button>
            }
          </div>
          <app-paginator [page]="p.page" [limit]="p.limit" [total]="p.total" (pageChange)="onPage($event)" />
        } @else {
          <app-empty-state
            illustration="empty-notifications"
            [title]="unreadOnly() ? 'No unread notifications' : 'No notifications yet'"
            message="You're all caught up. We'll let you know when something changes."
          />
        }
      }
    </section>
  `,
  styles: `
    /* Inside a portal (dashboard layout) the page already has padding. */
    :host-context(#dash-main) .container { max-width: none; padding-inline: 0; }
    :host-context(#dash-main) .section { padding-block: 0; }
    :host { display: block; }
    .dim { opacity: 0.6; transition: opacity var(--an-dur); }
    .item { display: flex; gap: var(--an-space-3); align-items: flex-start; padding: var(--an-space-3) var(--an-space-4); min-height: 64px; }
    .item.unread { background: linear-gradient(90deg, var(--an-gold-100), var(--an-surface) 35%); border-left: 3px solid var(--an-gold-500); }
    .ic { flex: none; width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-50); color: var(--an-navy-700); font-size: 1.1rem; }
    .unread .ic { background: var(--an-navy-900); color: var(--an-gold-300); }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .title { font-weight: 600; color: var(--an-navy-900); overflow-wrap: anywhere; display: flex; align-items: center; gap: 6px; }
    .unread .title { font-weight: 700; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--an-gold-500); flex: none; }
    .msg { color: var(--an-text-2); font-size: 0.92rem; overflow-wrap: anywhere; }
    .time { color: var(--an-text-muted); font-size: 0.8rem; }
    .chev { color: var(--an-text-muted); align-self: center; }
  `,
})
export default class NotificationsComponent implements OnInit {
  private readonly api = inject(NotificationsApiService);
  protected readonly store = inject(NotificationsStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly page = signal<Paginated<AppNotification> | null>(null);
  protected readonly unreadOnly = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly markingAll = signal(false);
  private query = { page: 1, limit: 20 };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .list({ ...this.query, unread: this.unreadOnly() ? true : undefined })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (p) => this.page.set(p), error: () => this.error.set(true) });
  }

  setUnread(value: boolean): void {
    this.unreadOnly.set(value);
    this.query = { ...this.query, page: 1 };
    this.load();
  }

  onPage(e: PageChange): void {
    this.query = { page: e.page, limit: e.limit };
    this.load();
  }

  markAll(): void {
    this.markingAll.set(true);
    this.api
      .markAllRead()
      .pipe(finalize(() => this.markingAll.set(false)))
      .subscribe(() => {
        this.store.clear();
        this.toast.success('All notifications marked as read.');
        if (this.unreadOnly()) {
          this.load();
        } else {
          const now = new Date().toISOString();
          this.page.update((p) => (p ? { ...p, items: p.items.map((n) => ({ ...n, readAt: n.readAt ?? now })) } : p));
        }
      });
  }

  iconFor(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('interview')) return 'bi-calendar-event';
    if (t.includes('placed') || t.includes('placement')) return 'bi-trophy';
    if (t.includes('shortlist')) return 'bi-star';
    if (t.includes('submission') || t.includes('submitted')) return 'bi-send-check';
    if (t.includes('stage')) return 'bi-signpost-split';
    if (t.includes('consent') || t.includes('privacy')) return 'bi-shield-lock';
    if (t.includes('requirement')) return 'bi-clipboard-data';
    if (t.includes('message')) return 'bi-chat-dots';
    if (t.includes('application') || t.includes('applicant')) return 'bi-clipboard-check';
    if (t.includes('job')) return 'bi-briefcase';
    if (t.includes('employer') || t.includes('company') || t.includes('recruiter')) return 'bi-buildings';
    if (t.includes('account') || t.includes('security')) return 'bi-shield-check';
    return 'bi-bell';
  }

  open(n: AppNotification): void {
    if (!n.readAt) {
      const now = new Date().toISOString();
      this.page.update((p) => (p ? { ...p, items: p.items.map((x) => (x.id === n.id ? { ...x, readAt: now } : x)) } : p));
      this.api.markRead(n.id).subscribe(() => this.store.decrement());
    }
    if (n.link) {
      if (/^https?:\/\//i.test(n.link)) {
        window.location.assign(n.link);
      } else {
        // v1 links (/seeker/…) are redirected to /candidate/… by the router.
        void this.router.navigateByUrl(n.link);
      }
    }
  }
}
