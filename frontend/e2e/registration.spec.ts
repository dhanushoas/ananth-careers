import { expect, test } from '@playwright/test';
import { uniqueSuffix } from './helpers';

test.describe('Candidate registration', () => {
  test('shows validation messages for an empty or invalid form', async ({ page }) => {
    await page.goto('/auth/register/candidate');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Full name is required.')).toBeVisible();
    await expect(page.getByText('Email is required.')).toBeVisible();
    await expect(page.getByText('Mobile number is required.')).toBeVisible();
    await expect(page.getByText('You must accept the Terms of use.')).toBeVisible();
    await expect(page.getByText('You must accept the Privacy policy.')).toBeVisible();

    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm password', { exact: true }).fill('different');
    await page.getByLabel('Mobile number').click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Password must be 8–128 characters long.')).toBeVisible();
  });

  test('registers a new candidate and asks them to verify their email', async ({ page }) => {
    const email = `e2e.candidate.${uniqueSuffix()}@veejee.example`;
    await page.goto('/auth/register');
    await page.getByTestId('choose-candidate').click();
    await expect(page).toHaveURL(/\/auth\/register\/candidate$/);

    await page.getByLabel('Full name').fill('Playwright Seeker');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mobile number').fill(`98${Math.floor(10000000 + Math.random() * 89999999)}`);
    await page.getByLabel('Password', { exact: true }).fill('Veejee@2026');
    await page.getByLabel('Confirm password', { exact: true }).fill('Veejee@2026');
    await page.locator('label[for="cd-fresher"]').click();
    await expect(page.getByRole('radio', { name: 'Fresher' })).toBeChecked();
    await page.getByRole('checkbox', { name: /may share my profile with client companies/ }).check();
    await page.getByRole('checkbox', { name: /Terms of use/ }).check();
    await page.getByRole('checkbox', { name: /Privacy policy/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByTestId('registration-success')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('new (unverified) accounts cannot sign in yet', async ({ page }) => {
    const email = `e2e.unverified.${uniqueSuffix()}@veejee.example`;
    await page.goto('/auth/register/candidate');
    await page.getByLabel('Full name').fill('Unverified User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mobile number').fill(`97${Math.floor(10000000 + Math.random() * 89999999)}`);
    await page.getByLabel('Password', { exact: true }).fill('Veejee@2026');
    await page.getByLabel('Confirm password', { exact: true }).fill('Veejee@2026');
    await page.getByRole('checkbox', { name: /Terms of use/ }).check();
    await page.getByRole('checkbox', { name: /Privacy policy/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByTestId('registration-success')).toBeVisible();

    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Veejee@2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByTestId('login-error')).toContainText(/verify your email/i);
    await expect(page.getByRole('button', { name: 'Resend verification email' })).toBeVisible();
  });
});
