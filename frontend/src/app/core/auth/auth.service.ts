import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiService } from '../http/api.service';
import { SKIP_AUTH_RETRY, SKIP_ERROR_TOAST } from '../http/http-context';
import {
  AuthUser,
  ChangePasswordRequest,
  Employer,
  GoogleAuthResponse,
  GoogleSignup,
  AuthProviders,
  LoginRequest,
  LoginResponse,
  RegisterEmployerRequest,
  RegisterCandidateRequest,
  Role,
  TokenPasswordRequest,
} from '../models';

/** Home (dashboard) route for each role. */
export const ROLE_HOME: Record<Role, string> = {
  candidate: '/candidate',
  employer: '/employer',
  recruiter: '/recruiter',
  admin: '/admin',
};

export interface MeResponse<P = unknown> {
  user: AuthUser;
  profile: P;
}

/**
 * Session state. The access token lives in memory only (a signal); the refresh token is an
 * httpOnly cookie managed by the server and is rotated via POST /auth/refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _initialized = signal(false);
  private refreshInFlight$: Observable<LoginResponse> | null = null;
  private providers$?: Observable<AuthProviders>;

  readonly user = this._user.asReadonly();
  readonly initialized = this._initialized.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null && this._token() !== null);
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);
  readonly isSuperAdmin = computed(() => this._user()?.role === 'admin' && this._user()!.permissions.includes('*'));
  /** Recruiter portal access: staff recruiters, or admins with `*` / `recruitment:manage`. */
  readonly canRecruit = computed(() => {
    const u = this._user();
    return !!u && (u.role === 'recruiter' || (u.role === 'admin' && (u.permissions.includes('*') || u.permissions.includes('recruitment:manage'))));
  });
  readonly homeUrl = computed(() => {
    const role = this.role();
    return role ? ROLE_HOME[role] : '/';
  });

  /** Current access token (memory only). */
  accessToken(): string | null {
    return this._token();
  }

  hasPermission(permission: string): boolean {
    const user = this._user();
    if (!user || user.role !== 'admin') {
      return false;
    }
    return user.permissions.includes('*') || user.permissions.includes(permission);
  }

  /** Restores a session on app start using the refresh cookie. Never rejects. */
  init(): Promise<void> {
    return firstValueFrom(
      this.refresh().pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
        finalize(() => this._initialized.set(true)),
      ),
    );
  }

  login(body: LoginRequest): Observable<AuthUser> {
    return this.api
      .post<LoginResponse>('/auth/login', body, { context: this.authContext() })
      .pipe(
        tap((res) => this.setSession(res)),
        map((res) => res.user),
      );
  }

  /**
   * Rotates the refresh token and obtains a new access token. Concurrent callers share a
   * single in-flight request (single-flight), which matters because reuse of a rotated
   * refresh token revokes the whole session family.
   */
  refresh(): Observable<LoginResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    this.refreshInFlight$ = this.api.post<LoginResponse>('/auth/refresh', {}, { context: this.authContext() }).pipe(
      tap((res) => this.setSession(res)),
      catchError((err: unknown) => {
        this.clearSession();
        return throwError(() => err);
      }),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  logout(redirectTo = '/'): Observable<void> {
    return this.api.post<unknown>('/auth/logout', {}, { context: this.authContext() }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => {
        this.clearSession();
        void this.router.navigateByUrl(redirectTo);
      }),
    );
  }

  logoutAll(): Observable<void> {
    return this.api.post<unknown>('/auth/logout-all').pipe(
      map(() => undefined),
      tap(() => {
        this.clearSession();
        void this.router.navigateByUrl('/auth/login');
      }),
    );
  }

  /** Clears local session state without contacting the server. */
  clearSession(): void {
    this._token.set(null);
    this._user.set(null);
  }

  /** Replaces the cached user (e.g. after a profile update). */
  setUser(user: AuthUser): void {
    this._user.set(user);
  }

  patchUser(patch: Partial<AuthUser>): void {
    const current = this._user();
    if (current) {
      this._user.set({ ...current, ...patch });
    }
  }

  /** Sign-in providers (Google client id is configured server-side; cached for the session). */
  providers(): Observable<AuthProviders> {
    this.providers$ ??= this.api
      .get<AuthProviders>('/auth/providers', { context: this.silent() })
      .pipe(
        catchError(() => of<AuthProviders>({ google: { enabled: false, clientId: null } })),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.providers$;
  }

  /**
   * Continue with Google: exchanges the GIS ID token (credential). An existing account is signed in;
   * an unknown email returns `signup_required` until `signup` details are supplied.
   */
  googleAuth(credential: string, signup?: GoogleSignup): Observable<GoogleAuthResponse> {
    return this.api
      .post<GoogleAuthResponse>('/auth/google', signup ? { credential, signup } : { credential }, { context: this.authContext() })
      .pipe(
        tap((res) => {
          if (res.status === 'signed_in') {
            this.setSession(res);
          }
        }),
      );
  }

  me<P = unknown>(): Observable<MeResponse<P>> {
    return this.api.get<MeResponse<P>>('/auth/me').pipe(tap((res) => this._user.set(res.user)));
  }

  registerCandidate(body: RegisterCandidateRequest): Observable<{ user: AuthUser }> {
    return this.api.post<{ user: AuthUser }>('/auth/register/candidate', body, { context: this.silent() });
  }

  registerEmployer(body: RegisterEmployerRequest): Observable<{ user: AuthUser; employer: Employer }> {
    return this.api.post<{ user: AuthUser; employer: Employer }>('/auth/register/employer', body, {
      context: this.silent(),
    });
  }

  verifyEmail(token: string): Observable<unknown> {
    return this.api.post<unknown>('/auth/verify-email', { token }, { context: this.silent() });
  }

  resendVerification(email: string): Observable<unknown> {
    return this.api.post<unknown>('/auth/resend-verification', { email });
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.api.post<unknown>('/auth/forgot-password', { email });
  }

  resetPassword(body: TokenPasswordRequest): Observable<unknown> {
    return this.api.post<unknown>('/auth/reset-password', body, { context: this.silent() });
  }

  acceptInvite(body: TokenPasswordRequest): Observable<unknown> {
    return this.api.post<unknown>('/auth/accept-invite', body, { context: this.silent() });
  }

  changePassword(body: ChangePasswordRequest): Observable<unknown> {
    return this.api.post<unknown>('/auth/change-password', body, { context: this.silent() });
  }

  private setSession(res: LoginResponse): void {
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }

  private authContext(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true).set(SKIP_AUTH_RETRY, true);
  }

  private silent(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true);
  }
}
