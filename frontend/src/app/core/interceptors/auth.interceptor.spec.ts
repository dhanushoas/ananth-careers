import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { AuthUser, LoginResponse } from '../models';

const user: AuthUser = {
  id: 'u1',
  name: 'Employer One',
  email: 'employer@veejee.example',
  mobile: '9876543210',
  role: 'employer',
  status: 'active',
  emailVerified: true,
  permissions: [],
  hasAvatar: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ok = <T>(data: T) => ({ success: true, message: 'ok', data, timestamp: '' });
const expired = { success: false, message: 'Token expired', errorCode: 'TOKEN_EXPIRED' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  function signIn(token = 'old-token'): void {
    auth.login({ email: user.email, password: 'x' }).subscribe();
    backend.expectOne('/api/v1/auth/login').flush(ok<LoginResponse>({ accessToken: token, expiresIn: 900, user }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('adds Bearer + X-Requested-With to API calls but not withCredentials for non-auth paths', () => {
    signIn();
    http.get('/api/v1/jobs/mine').subscribe();
    const req = backend.expectOne('/api/v1/jobs/mine');
    expect(req.request.headers.get('Authorization')).toBe('Bearer old-token');
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.withCredentials).toBe(false);
    req.flush(ok([]));
  });

  it('does not touch non-API requests', () => {
    signIn();
    http.get('https://fonts.googleapis.com/css').subscribe();
    const req = backend.expectOne('https://fonts.googleapis.com/css');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush('');
  });

  it('on 401 TOKEN_EXPIRED refreshes once and retries with the new token', () => {
    signIn();
    let body: unknown;
    http.get('/api/v1/employers/me').subscribe((b) => (body = b));

    backend.expectOne('/api/v1/employers/me').flush(expired, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(ok<LoginResponse>({ accessToken: 'new-token', expiresIn: 900, user }));

    const retry = backend.expectOne('/api/v1/employers/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush(ok({ id: 'e1' }));

    expect(body).toEqual(ok({ id: 'e1' }));
    expect(auth.accessToken()).toBe('new-token');
  });

  it('concurrent expired requests share a single refresh (single-flight)', () => {
    signIn();
    const done: string[] = [];
    http.get('/api/v1/a').subscribe(() => done.push('a'));
    http.get('/api/v1/b').subscribe(() => done.push('b'));

    backend.expectOne('/api/v1/a').flush(expired, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/b').flush(expired, { status: 401, statusText: 'Unauthorized' });

    const refreshes = backend.match('/api/v1/auth/refresh');
    expect(refreshes.length).toBe(1);
    refreshes[0].flush(ok<LoginResponse>({ accessToken: 'new-token', expiresIn: 900, user }));

    const ra = backend.expectOne('/api/v1/a');
    const rb = backend.expectOne('/api/v1/b');
    expect(ra.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(rb.request.headers.get('Authorization')).toBe('Bearer new-token');
    ra.flush(ok(1));
    rb.flush(ok(2));
    expect(done.sort()).toEqual(['a', 'b']);
  });

  it('does not refresh for other 401 codes', () => {
    signIn();
    let status = 0;
    http.get('/api/v1/x').subscribe({ error: (e: { status: number }) => (status = e.status) });
    backend
      .expectOne('/api/v1/x')
      .flush({ success: false, message: 'no', errorCode: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone('/api/v1/auth/refresh');
    expect(status).toBe(401);
  });

  it('when the refresh fails, clears the session, redirects to login and propagates the error', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    signIn();
    let failed = false;
    http.get('/api/v1/y').subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/v1/y').flush(expired, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush({ success: false, message: 'reuse', errorCode: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], expect.anything());
    backend.expectNone('/api/v1/y');
  });

  it('never retries the refresh endpoint itself', () => {
    signIn();
    auth.refresh().subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/auth/refresh').flush(expired, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone('/api/v1/auth/refresh');
  });
});
