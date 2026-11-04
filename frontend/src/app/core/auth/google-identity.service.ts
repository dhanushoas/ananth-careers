import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Minimal typings for the parts of Google Identity Services (GIS) we use. */
export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    context?: 'signin' | 'signup' | 'use';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
  disableAutoSelect(): void;
}

interface GoogleGlobal {
  accounts: { id: GoogleIdApi };
}

export const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Loads the Google Identity Services script on demand (only pages that show "Continue with Google"
 * call this) and renders the official button. The client id always comes from GET /auth/providers.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private readonly document = inject(DOCUMENT);
  private loading?: Promise<GoogleGlobal>;

  load(): Promise<GoogleGlobal> {
    const win = this.document.defaultView as (Window & { google?: GoogleGlobal }) | null;
    if (win?.google?.accounts?.id) {
      return Promise.resolve(win.google);
    }
    this.loading ??= new Promise<GoogleGlobal>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const g = (this.document.defaultView as (Window & { google?: GoogleGlobal }) | null)?.google;
        if (g?.accounts?.id) {
          resolve(g);
        } else {
          reject(new Error('Google Identity Services failed to initialise'));
        }
      };
      script.onerror = () => {
        this.loading = undefined;
        script.remove();
        reject(new Error('Google Identity Services could not be loaded'));
      };
      this.document.head.appendChild(script);
    });
    return this.loading;
  }

  /** Initialises GIS for this page and renders the button into `container`. */
  async renderButton(
    container: HTMLElement,
    clientId: string,
    context: 'signin' | 'signup',
    onCredential: (credential: string) => void,
  ): Promise<void> {
    const google = await this.load();
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
      ux_mode: 'popup',
      context,
      cancel_on_tap_outside: true,
    });
    const width = Math.max(200, Math.min(400, Math.floor(container.getBoundingClientRect().width || 320)));
    container.innerHTML = '';
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      width,
      locale: 'en',
    });
  }
}
