import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD, login, logout } from './helpers';

test.describe('Login', () => {
  test('rejects wrong credentials with a friendly message', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(ACCOUNTS.candidate);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword1');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('candidate signs in, the session survives a reload, and no token is stored', async ({ page }) => {
    await login(page, 'candidate');
    await page.reload();
    await expect(page).toHaveURL(/\/candidate/);
    await expect(page.getByTestId('user-menu')).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain('eyJ');
    await logout(page);
    await page.goto('/candidate');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fcandidate/);
  });

  test('returnUrl brings the user back after login', async ({ page }) => {
    await page.goto('/candidate/applications');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/);
    await page.getByLabel('Email').fill(ACCOUNTS.candidate);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/candidate\/applications/);
  });

  for (const who of ['employer', 'recruiter', 'admin'] as const) {
    test(`${who} signs in to the right portal`, async ({ page }) => {
      await login(page, who);
      await expect(page.getByTestId('notification-bell')).toBeVisible();
    });
  }

  test('role guards: a candidate cannot open the recruiter or admin portals; an employer cannot open the recruiter portal', async ({ page }) => {
    await login(page, 'candidate');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/forbidden/);
    await page.goto('/recruiter');
    await expect(page).toHaveURL(/\/forbidden/);
    await logout(page);
    await login(page, 'employer');
    await page.goto('/recruiter/candidates');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('a super admin can open the recruiter portal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/recruiter');
    await expect(page).toHaveURL(/\/recruiter$/);
  });
});
