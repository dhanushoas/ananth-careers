import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import RegisterCandidateComponent from './register-candidate.component';

describe('RegisterCandidateComponent', () => {
  let fixture: ComponentFixture<RegisterCandidateComponent>;
  let component: RegisterCandidateComponent;
  let http: HttpTestingController;

  const valid = {
    name: 'Asha Rao',
    email: 'asha@example.com',
    mobile: '+91 98765 43210',
    password: 'Secure123',
    confirmPassword: 'Secure123',
    careerLevel: 'experienced' as const,
    shareProfileConsent: true,
    acceptTerms: true,
    acceptPrivacy: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterCandidateComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterCandidateComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    // The page asks which sign-in providers are enabled (Google disabled here).
    http
      .match('/api/v1/auth/providers')
      .forEach((r) => r.flush({ success: true, message: 'ok', data: { google: { enabled: false, clientId: null } }, timestamp: '' }));
  });

  afterEach(() => http.verify());

  it('is invalid when empty and requires every field plus both consents', () => {
    const f = component.form;
    expect(f.valid).toBe(false);
    expect(f.controls.name.hasError('required')).toBe(true);
    expect(f.controls.email.hasError('required')).toBe(true);
    expect(f.controls.mobile.hasError('required')).toBe(true);
    expect(f.controls.password.hasError('required')).toBe(true);
    expect(f.controls.acceptTerms.hasError('required')).toBe(true);
    expect(f.controls.acceptPrivacy.hasError('required')).toBe(true);
  });

  it('validates email format and mobile number', () => {
    const f = component.form.controls;
    f.email.setValue('not-an-email');
    expect(f.email.hasError('email')).toBe(true);
    f.mobile.setValue('12345');
    expect(f.mobile.hasError('mobile')).toBe(true);
    f.mobile.setValue('9876543210');
    expect(f.mobile.valid).toBe(true);
  });

  it('enforces the password policy (8–128 chars, letter + digit)', () => {
    const p = component.form.controls.password;
    p.setValue('short1');
    expect(p.hasError('passwordLength')).toBe(true);
    p.setValue('lettersonly');
    expect(p.hasError('passwordComplexity')).toBe(true);
    p.setValue('12345678');
    expect(p.hasError('passwordComplexity')).toBe(true);
    p.setValue('Veejee2026');
    expect(p.valid).toBe(true);
  });

  it('flags mismatched password confirmation', () => {
    component.form.patchValue({ ...valid, confirmPassword: 'Different123' });
    expect(component.form.controls.confirmPassword.hasError('mismatch')).toBe(true);
    expect(component.form.valid).toBe(false);
    component.form.patchValue({ confirmPassword: valid.password });
    expect(component.form.controls.confirmPassword.hasError('mismatch')).toBe(false);
    expect(component.form.valid).toBe(true);
  });

  it('does not submit an invalid form and shows messages', async () => {
    component.submit();
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectNone('/api/v1/auth/register/candidate');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Full name is required.');
    expect(text).toContain('You must accept the Terms of use.');
  });

  it('submits the contract body and shows the success state', async () => {
    component.form.setValue(valid);
    component.submit();
    const req = http.expectOne('/api/v1/auth/register/candidate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Asha Rao',
      email: 'asha@example.com',
      mobile: '+91 98765 43210',
      password: 'Secure123',
      acceptTerms: true,
      acceptPrivacy: true,
      careerLevel: 'experienced',
      shareProfileConsent: true,
    });
    req.flush({ success: true, message: 'Registered', data: { user: {} }, timestamp: '' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.done()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="registration-success"]')).not.toBeNull();
  });

  it('maps server validation details onto fields and handles duplicates', () => {
    component.form.setValue(valid);
    component.submit();
    http.expectOne('/api/v1/auth/register/candidate').flush(
      {
        success: false,
        message: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        details: [{ field: 'mobile', message: 'Mobile already in use' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.form.controls.mobile.getError('server')).toBe('Mobile already in use');

    component.form.patchValue({ mobile: '9876500000' });
    component.submit();
    http
      .expectOne('/api/v1/auth/register/candidate')
      .flush({ success: false, message: 'Exists', errorCode: 'DUPLICATE_RESOURCE' }, { status: 409, statusText: 'Conflict' });
    expect(component.form.controls.email.getError('server')).toContain('already exists');
  });
});
