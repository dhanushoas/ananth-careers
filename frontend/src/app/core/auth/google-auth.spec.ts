import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { GIS_SCRIPT_SRC, GoogleIdentityService } from './google-identity.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthUser, GoogleAuthResponse } from '../models';

const ok = <T>(data: T) => ({ success: true, message: 'ok', data, timestamp: '' });

const user: AuthUser = {
  id: 'u9',
  name: 'Meera Joshi',
  email: 'meera@veejee.example',
  mobile: '9876543210',
  role: 'candidate',
  status: 'active',
  emailVerified: true,
  permissions: [],
  hasAvatar: false,
  createdAt: '',
};

describe('Google sign-in (AuthService + GoogleIdentityService)', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    document.querySelectorAll(`script[src="${GIS_SCRIPT_SRC}"]`).forEach((s) => s.remove());
  });

  it('providers() reads the runtime client id once and caches it', () => {
    const results: (string | null)[] = [];
    auth.providers().subscribe((p) => results.push(p.google.clientId));
    auth.providers().subscribe((p) => results.push(p.google.clientId));
    http.expectOne('/api/v1/auth/providers').flush(ok({ google: { enabled: true, clientId: 'abc.apps.googleusercontent.com' } }));
    expect(results).toEqual(['abc.apps.googleusercontent.com', 'abc.apps.googleusercontent.com']);
  });

  it('providers() falls back to disabled when the endpoint fails (button simply hidden)', () => {
    let enabled: boolean | undefined;
    auth.providers().subscribe((p) => (enabled = p.google.enabled));
    http.expectOne('/api/v1/auth/providers').flush(null, { status: 500, statusText: 'Server Error' });
    expect(enabled).toBe(false);
  });

  it('googleAuth signed_in stores the session in memory with cookies + CSRF header', () => {
    let res: GoogleAuthResponse | undefined;
    auth.googleAuth('google-id-token').subscribe((r) => (res = r));
    const req = http.expectOne('/api/v1/auth/google');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ credential: 'google-id-token' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    req.flush(ok({ status: 'signed_in', accessToken: 'g-tok', expiresIn: 900, user }));
    expect(res?.status).toBe('signed_in');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('g-tok');
    expect(auth.homeUrl()).toBe('/candidate');
  });

  it('googleAuth signup_required does not create a session; signup details are sent on the second call', () => {
    let first: GoogleAuthResponse | undefined;
    auth.googleAuth('tok').subscribe((r) => (first = r));
    http.expectOne('/api/v1/auth/google').flush(ok({ status: 'signup_required', profile: { email: 'n@veejee.example', name: 'New User' } }));
    expect(first?.status).toBe('signup_required');
    expect(auth.isAuthenticated()).toBe(false);

    auth
      .googleAuth('tok', { role: 'employer', mobile: '9876543210', acceptTerms: true, acceptPrivacy: true, companyName: 'Acme', industryId: 'i1' })
      .subscribe();
    const req = http.expectOne('/api/v1/auth/google');
    expect(req.request.body.signup.role).toBe('employer');
    expect(req.request.body.signup.companyName).toBe('Acme');
    req.flush(ok({ status: 'signed_in', accessToken: 't2', expiresIn: 900, user: { ...user, role: 'employer' } }));
    expect(auth.homeUrl()).toBe('/employer');
  });

  it('GoogleIdentityService loads the GIS script once, on demand', () => {
    const gis = TestBed.inject(GoogleIdentityService);
    expect(document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)).toBeNull();
    void gis.load().catch(() => undefined);
    void gis.load().catch(() => undefined);
    expect(document.querySelectorAll(`script[src="${GIS_SCRIPT_SRC}"]`).length).toBe(1);
  });
});
