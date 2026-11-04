import { expect, test, Page } from '@playwright/test';

/** Stub of Google Identity Services: records init + renders a placeholder button (no network to Google). */
const GIS_STUB = `
  window.google = { accounts: { id: {
    initialize: function (cfg) { window.__gisInit = cfg; },
    renderButton: function (el, opts) {
      window.__gisOpts = opts;
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Continue with Google'; b.setAttribute('data-testid', 'gis-stub-button');
      el.appendChild(b);
    },
    disableAutoSelect: function () {}
  } } };
`;

async function enableGoogle(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/providers', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'ok', data: { google: { enabled: true, clientId: 'e2e-client.apps.googleusercontent.com' } }, timestamp: '' }),
    }),
  );
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: GIS_STUB }),
  );
}

test.describe('Continue with Google', () => {
  test('is hidden when the provider is disabled (no Google script requested)', async ({ page }) => {
    const gisRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().startsWith('https://accounts.google.com/')) gisRequests.push(r.url());
    });
    await page.route('**/api/v1/auth/providers', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'ok', data: { google: { enabled: false, clientId: null } }, timestamp: '' }),
      }),
    );
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('google-signin')).toHaveCount(0);
    expect(gisRequests).toEqual([]);
  });

  for (const path of ['/auth/login', '/auth/register', '/auth/register/candidate', '/auth/register/employer']) {
    test(`renders the Google button with the runtime client id on ${path}`, async ({ page }) => {
      await enableGoogle(page);
      await page.goto(path);
      const block = page.getByTestId('google-signin');
      await expect(block).toBeVisible();
      await expect(block.getByTestId('gis-stub-button')).toBeVisible();
      await expect(block.getByRole('separator')).toContainText('or');
      const init = await page.evaluate(() => (window as unknown as { __gisInit?: { client_id: string; ux_mode: string; context: string } }).__gisInit);
      expect(init?.client_id).toBe('e2e-client.apps.googleusercontent.com');
      expect(init?.ux_mode).toBe('popup');
      expect(init?.context).toBe(path === '/auth/login' ? 'signin' : 'signup');
      const opts = await page.evaluate(() => (window as unknown as { __gisOpts?: { text: string; shape: string } }).__gisOpts);
      expect(opts?.text).toBe('continue_with');
      expect(opts?.shape).toBe('pill');
    });
  }

  test('"Finish creating your account" without a pending Google sign-in asks to start again', async ({ page }) => {
    await page.goto('/auth/google-complete');
    await expect(page.getByText(/Google sign-in session has ended/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });
});
