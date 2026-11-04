import { expect, test } from '@playwright/test';
import { login, logout, selectFirstOption, selectOption, toast, uniqueSuffix } from './helpers';

test.describe('Recruitment requirements', () => {
  test('employer validation: required fields', async ({ page }) => {
    await login(page, 'employer');
    await page.goto('/employer/requirements/new');
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.getByText('Job title is required.')).toBeVisible();
  });

  test('employer posts a requirement and a Veejee Services admin approves it', async ({ page }) => {
    const title = `E2E Frontend Engineer ${uniqueSuffix()}`;
    await login(page, 'employer');
    await page.goto('/employer/requirements/new');
    await page.getByLabel('Job title', { exact: true }).fill(title);
    await selectFirstOption(page, 'Industry');
    await selectOption(page, 'Employment type', 'Full-time');
    await selectOption(page, 'Work mode', 'Hybrid');
    await page.getByLabel('Vacancies', { exact: true }).fill('2');
    await page
      .getByLabel('Job description', { exact: true })
      .fill('E2E requirement created by Playwright. Build and maintain customer-facing web applications with a friendly team.');
    await page.getByLabel('City', { exact: true }).first().fill('Pune');
    await page.getByLabel('Country', { exact: true }).first().fill('India');
    await page.getByLabel('Minimum experience (years)', { exact: true }).fill('1');
    await page.getByLabel('Maximum experience (years)', { exact: true }).fill('4');
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(toast(page, /submitted for approval/i)).toBeVisible();
    await expect(page).toHaveURL(/\/employer\/requirements(\?|$)/);
    await expect(page.getByTestId('requirement-row').filter({ hasText: title })).toContainText(/Pending approval/i);
    await logout(page);

    await login(page, 'admin');
    await page.goto('/admin/jobs?status=pending_approval');
    await page.getByTestId('admin-job-search').fill(title);
    await expect(page).toHaveURL(/[?&]q=/);
    const row = page.getByTestId('admin-job-row').filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(toast(page, 'Requirement approved')).toBeVisible();

    await page.goto(`/jobs?q=${encodeURIComponent(title)}`);
    await expect(page.getByTestId('job-card').filter({ hasText: title })).toBeVisible();
  });
});
