import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GoogleIdentityService } from '../../core/auth/google-identity.service';
import { GoogleSigninComponent } from './google-signin.component';

describe('GoogleSigninComponent', () => {
  const renderButton = vi.fn().mockResolvedValue(undefined);

  async function render(enabled: boolean, clientId: string | null): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [GoogleSigninComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { providers: () => of({ google: { enabled, clientId } }) } },
        { provide: GoogleIdentityService, useValue: { renderButton } },
      ],
    });
    const fixture = TestBed.createComponent(GoogleSigninComponent);
    fixture.componentRef.setInput('context', 'signup');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => renderButton.mockClear());

  it('renders nothing (and never loads Google) when the provider is disabled', async () => {
    const el = await render(false, null);
    expect(el.querySelector('[data-testid="google-signin"]')).toBeNull();
    expect(renderButton).not.toHaveBeenCalled();
  });

  it('renders the button container + "or" divider using the runtime client id', async () => {
    const el = await render(true, 'runtime-client.apps.googleusercontent.com');
    expect(el.querySelector('[data-testid="google-signin"]')).not.toBeNull();
    expect(el.querySelector('[role="separator"]')?.textContent).toContain('or');
    expect(renderButton).toHaveBeenCalledTimes(1);
    const [container, clientId, context] = renderButton.mock.calls[0] as [HTMLElement, string, string];
    expect(container).toBeInstanceOf(HTMLElement);
    expect(clientId).toBe('runtime-client.apps.googleusercontent.com');
    expect(context).toBe('signup');
  });
});
