import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth.service';
import { AuthUser, Role } from '../models';
import { authGuard, guestGuard, permissionGuard, recruiterPortalGuard, roleGuard } from './guards';

function makeUser(role: Role, permissions: string[] = []): AuthUser {
  return {
    id: 'u',
    name: 'Test',
    email: 't@x',
    mobile: '9999999999',
    role,
    status: 'active',
    emailVerified: true,
    permissions,
    hasAvatar: false,
    createdAt: '',
  };
}

describe('route guards', () => {
  let auth: AuthService;
  let router: Router;
  const route = { data: {} } as unknown as ActivatedRouteSnapshot;
  const state = { url: '/employer/jobs' } as RouterStateSnapshot;

  /** Establishes a session through the real login flow (mocked backend). */
  function signInAs(user: AuthUser | null): void {
    auth.clearSession();
    if (!user) return;
    auth.login({ email: user.email, password: 'x' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({ success: true, message: 'ok', data: { accessToken: 'token', expiresIn: 900, user }, timestamp: '' });
  }

  const run = (guard: typeof authGuard, r: ActivatedRouteSnapshot = route) =>
    TestBed.runInInjectionContext(() => guard(r, state));

  const urlOf = (result: unknown): string => router.serializeUrl(result as UrlTree);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('redirects anonymous users to login with returnUrl', () => {
      signInAs(null);
      expect(urlOf(run(authGuard))).toBe('/auth/login?returnUrl=%2Femployer%2Fjobs');
    });
    it('allows signed-in users', () => {
      signInAs(makeUser('candidate'));
      expect(run(authGuard)).toBe(true);
    });
  });

  describe('roleGuard', () => {
    it('allows a matching role', () => {
      signInAs(makeUser('employer'));
      expect(run(roleGuard('employer'))).toBe(true);
    });
    it('sends a mismatched role to /forbidden', () => {
      signInAs(makeUser('candidate'));
      expect(urlOf(run(roleGuard('employer')))).toBe('/forbidden');
    });
    it('sends anonymous users to login', () => {
      signInAs(null);
      expect(urlOf(run(roleGuard('admin')))).toContain('/auth/login');
    });
  });

  describe('guestGuard', () => {
    it('allows anonymous visitors', () => {
      signInAs(null);
      expect(run(guestGuard)).toBe(true);
    });
    it('redirects signed-in users to their dashboard', () => {
      signInAs(makeUser('employer'));
      expect(urlOf(run(guestGuard))).toBe('/employer');
      signInAs(makeUser('admin', ['*']));
      expect(urlOf(run(guestGuard))).toBe('/admin');
    });
  });

  describe('permissionGuard', () => {
    it('allows admins with the permission or *', () => {
      signInAs(makeUser('admin', ['jobs:moderate']));
      expect(run(permissionGuard('jobs:moderate'))).toBe(true);
      signInAs(makeUser('admin', ['*']));
      expect(run(permissionGuard('audit:view'))).toBe(true);
    });
    it('blocks admins without the permission', () => {
      signInAs(makeUser('admin', ['jobs:moderate']));
      expect(urlOf(run(permissionGuard('users:manage')))).toBe('/forbidden');
    });
    it('reads the permission from route data when not passed explicitly', () => {
      signInAs(makeUser('admin', ['content:manage']));
      const r = { data: { permission: 'content:manage' } } as unknown as ActivatedRouteSnapshot;
      expect(run(permissionGuard(), r)).toBe(true);
    });
    it('blocks non-admins even if they somehow hold the string', () => {
      signInAs(makeUser('employer', ['*']));
      expect(urlOf(run(permissionGuard('users:manage')))).toBe('/forbidden');
    });
  });

  describe('recruiterPortalGuard', () => {
    it('allows Veejee Services recruiters', () => {
      signInAs(makeUser('recruiter'));
      expect(run(recruiterPortalGuard)).toBe(true);
    });
    it('allows admins with * or recruitment:manage only', () => {
      signInAs(makeUser('admin', ['recruitment:manage']));
      expect(run(recruiterPortalGuard)).toBe(true);
      signInAs(makeUser('admin', ['*']));
      expect(run(recruiterPortalGuard)).toBe(true);
      signInAs(makeUser('admin', ['reports:view']));
      expect(urlOf(run(recruiterPortalGuard))).toBe('/forbidden');
    });
    it('blocks employers and candidates', () => {
      signInAs(makeUser('employer'));
      expect(urlOf(run(recruiterPortalGuard))).toBe('/forbidden');
      signInAs(makeUser('candidate'));
      expect(urlOf(run(recruiterPortalGuard))).toBe('/forbidden');
    });
  });
});
