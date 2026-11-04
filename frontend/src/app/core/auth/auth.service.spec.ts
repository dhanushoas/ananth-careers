import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthUser, LoginResponse } from '../models';

const user: AuthUser = {
  id: 'u1',
  name: 'Asha Rao',
  email: 'seeker@veejee.example',
  mobile: '9876543210',
  role: 'candidate',
  status: 'active',
  emailVerified: true,
  permissions: [],
  hasAvatar: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

function envelope<T>(data: T): { success: true; message: string; data: T; timestamp: string } {
  return { success: true, message: 'ok', data, timestamp: new Date().toISOString() };
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('starts signed out', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.homeUrl()).toBe('/');
  });

  it('login stores the token in memory and exposes the user', () => {
    let result: AuthUser | undefined;
    service.login({ email: user.email, password: 'Veejee@2026' }).subscribe((u) => (result = u));

    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: user.email, password: 'Veejee@2026' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(envelope<LoginResponse>({ accessToken: 'tok-1', expiresIn: 900, user }));

    expect(result).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('tok-1');
    expect(service.role()).toBe('candidate');
    expect(service.homeUrl()).toBe('/candidate');
    // never persisted
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('login failure leaves the session empty', () => {
    let failed = false;
    service.login({ email: user.email, password: 'wrong' }).subscribe({ error: () => (failed = true) });
    http
      .expectOne('/api/v1/auth/login')
      .flush({ success: false, message: 'Invalid', errorCode: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('refresh rotates the token using the cookie (withCredentials) and is single-flight', () => {
    const results: string[] = [];
    service.refresh().subscribe((r) => results.push(r.accessToken));
    service.refresh().subscribe((r) => results.push(r.accessToken));

    const reqs = http.match('/api/v1/auth/refresh');
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.withCredentials).toBe(true);
    expect(reqs[0].request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    reqs[0].flush(envelope<LoginResponse>({ accessToken: 'tok-2', expiresIn: 900, user }));

    expect(results).toEqual(['tok-2', 'tok-2']);
    expect(service.accessToken()).toBe('tok-2');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('a failed refresh clears the session', () => {
    service.login({ email: user.email, password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(envelope<LoginResponse>({ accessToken: 'tok-1', expiresIn: 900, user }));
    expect(service.isAuthenticated()).toBe(true);

    service.refresh().subscribe({ error: () => undefined });
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ success: false, message: 'Nope', errorCode: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('init() resolves even when there is no refresh cookie', async () => {
    const done = service.init();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ success: false, message: 'No session', errorCode: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });
    await expect(done).resolves.toBeUndefined();
    expect(service.initialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('logout calls the cookie endpoint, clears state and navigates home', () => {
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    service.login({ email: user.email, password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(envelope<LoginResponse>({ accessToken: 'tok-1', expiresIn: 900, user }));

    service.logout().subscribe();
    const req = http.expectOne('/api/v1/auth/logout');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    req.flush(envelope(null));

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('logout still clears local state when the server call fails', () => {
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    service.login({ email: user.email, password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(envelope<LoginResponse>({ accessToken: 'tok-1', expiresIn: 900, user }));

    service.logout().subscribe();
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('hasPermission honours * and explicit admin permissions only', () => {
    service.setUser({ ...user, role: 'admin', permissions: ['jobs:moderate'] });
    expect(service.hasPermission('jobs:moderate')).toBe(true);
    expect(service.hasPermission('users:manage')).toBe(false);
    service.setUser({ ...user, role: 'admin', permissions: ['*'] });
    expect(service.hasPermission('users:manage')).toBe(true);
    service.setUser({ ...user, role: 'employer', permissions: ['*'] });
    expect(service.hasPermission('users:manage')).toBe(false);
    expect(service.canRecruit()).toBe(false);
  });

  it('maps Veejee Services recruiters to the recruiter portal', () => {
    service.login({ email: 'r@x', password: 'x' }).subscribe();
    http
      .expectOne('/api/v1/auth/login')
      .flush(envelope<LoginResponse>({ accessToken: 't', expiresIn: 900, user: { ...user, role: 'recruiter' } }));
    expect(service.homeUrl()).toBe('/recruiter');
    expect(service.canRecruit()).toBe(true);
  });
});
