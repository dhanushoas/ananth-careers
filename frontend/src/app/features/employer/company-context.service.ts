import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/http/api.service';
import { silentContext } from '../../core/http/http-context';
import { Employer } from '../../core/models';

/** The signed-in company (GET /employers/me), cached per user for the employer portal. */
@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private loadedFor: string | null = null;
  private inFlight$: Observable<void> | null = null;

  readonly employer = signal<Employer | null>(null);
  readonly loading = signal(false);
  readonly employerError = signal(false);
  readonly companyVerified = computed(() => this.employer()?.verificationStatus === 'verified');

  ensureLoaded(): Observable<void> {
    const userId = this.auth.user()?.id ?? null;
    if (userId && this.loadedFor === userId && this.employer()) {
      return of(undefined);
    }
    return this.reload();
  }

  reload(): Observable<void> {
    if (this.inFlight$) {
      return this.inFlight$;
    }
    const userId = this.auth.user()?.id ?? null;
    this.loading.set(true);
    this.inFlight$ = this.api.get<Employer>('/employers/me', { context: silentContext() }).pipe(
      tap((employer) => {
        this.employerError.set(false);
        this.employer.set(employer);
        this.loadedFor = userId;
      }),
      map(() => undefined),
      catchError(() => {
        this.employerError.set(true);
        this.employer.set(null);
        return of(undefined);
      }),
      finalize(() => {
        this.loading.set(false);
        this.inFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inFlight$;
  }

  setEmployer(employer: Employer): void {
    this.employer.set(employer);
  }
}

/** Loads the company before entering the portal (never blocks on errors). */
export const companyContextGuard: CanActivateFn = () => inject(CompanyContextService).ensureLoaded().pipe(map(() => true));
