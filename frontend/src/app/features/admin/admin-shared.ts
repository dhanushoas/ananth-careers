import { DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Observable, Subscription, finalize } from 'rxjs';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { Paginated } from '../../core/models';

/** Signal-based state for a paginated admin list. Must be created in an injection context. */
export class PagedList<T extends { id: string }> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private sub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
  }

  load(source: Observable<Paginated<T>>): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.sub = source.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (p) => {
        this.items.set(p.items ?? []);
        this.total.set(p.total ?? 0);
        this.page.set(p.page ?? 1);
        this.limit.set(p.limit ?? 20);
      },
      error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))),
    });
  }

  replace(item: T): void {
    this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, ...item } : i)));
  }

  patch(id: string, patch: Partial<T>): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  remove(id: string): void {
    this.items.update((list) => list.filter((i) => i.id !== id));
    this.total.update((n) => Math.max(0, n - 1));
  }
}

/** Merges `patch` into the current query params (null removes a key). Resets page unless given. */
export function updateQuery(router: Router, route: ActivatedRoute, patch: Params): void {
  const queryParams: Params = { page: null, ...patch };
  for (const key of Object.keys(queryParams)) {
    if (queryParams[key] === '' || queryParams[key] === undefined) {
      queryParams[key] = null;
    }
  }
  void router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
}

export function intParam(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Narrow a query param to one of the allowed values. */
export function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Common styles for admin list pages (Bootstrap based). */
export const ADMIN_LIST_STYLES = `
  .cell-main { font-weight: 600; color: var(--an-text); overflow-wrap: anywhere; }
  .cell-sub { font-size: 0.82rem; color: var(--an-text-muted); overflow-wrap: anywhere; }
  .actions-cell { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  td.right, th.right { text-align: right; }
  .nowrap { white-space: nowrap; }
  .detail-grid { display: grid; gap: var(--an-space-2) var(--an-space-5); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); font-size: 0.9rem; margin: 0; }
  .detail-grid dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--an-text-muted); font-weight: 600; }
  .detail-grid dd { margin: 0 0 var(--an-space-2); overflow-wrap: anywhere; }
  .count { color: var(--an-text-muted); font-size: 0.88rem; margin: 0 0 var(--an-space-2); }
  .m-card { border-radius: var(--an-radius-lg); }
  .m-card .card-body { display: flex; flex-direction: column; gap: 8px; }
  .m-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .m-actions .btn { flex: 1 1 auto; }
  .mobile-list { display: grid; gap: var(--an-space-3); }
`;

/** Display name for an audit-log actor (populated object or bare id). */
export function auditActorName(actor: { name?: string; email?: string } | string | null | undefined): string {
  if (!actor) return 'System';
  if (typeof actor === 'string') return actor;
  return actor.name || actor.email || 'Unknown';
}
