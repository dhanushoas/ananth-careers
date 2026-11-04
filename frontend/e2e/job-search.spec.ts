import { expect, test } from '@playwright/test';

test.describe('Job search & filters', () => {
  test('lists published jobs and opens a job', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.getByTestId('results-count')).toBeVisible();
    const cards = page.getByTestId('job-card');
    await expect(cards.first()).toBeVisible();

    const title = (await cards.first().locator('h3').innerText()).trim();
    await cards.first().locator('h3 a').click();
    await expect(page).toHaveURL(/\/jobs\/[^/?]+$/);
    await expect(page.getByTestId('job-title')).toHaveText(title);
    await expect(page.getByTestId('apply-panel')).toBeVisible();
  });

  test('keyword and location search are reflected in the URL', async ({ page }) => {
    await page.goto('/jobs');
    await page.getByTestId('search-keyword').fill('engineer');
    await page.getByTestId('search-location').fill('Bengaluru');
    await page.getByTestId('search-submit').click();
    await expect(page).toHaveURL(/[?&]q=engineer/);
    await expect(page).toHaveURL(/[?&]location=Bengaluru/);
    await expect(page.getByTestId('results-count')).toBeVisible();
    
  });

  test('filters sync to query params and survive a reload', async ({ page }) => {
    await page.goto('/jobs');
    const filters = page.getByTestId('job-filters');

    await filters.getByRole('checkbox', { name: 'Full-time' }).check();
    await expect(page).toHaveURL(/employmentType=full_time/);

    await filters.getByRole('checkbox', { name: 'Remote' }).check();
    await expect(page).toHaveURL(/workMode=remote/);

    await page.getByTestId('filter-industry').selectOption({ index: 1 }); // first real industry
    await expect(page).toHaveURL(/industry=[a-z0-9-]+/);

    await page.reload();
    await expect(filters.getByRole('checkbox', { name: 'Full-time' })).toBeChecked();
    await expect(filters.getByRole('checkbox', { name: 'Remote' })).toBeChecked();

    // Every visible result matches the employment type filter.
    const count = await page.getByTestId('job-card').count();
    for (let i = 0; i < count; i++) {
      await expect(page.getByTestId('job-card').nth(i)).toContainText('Full-time');
    }

    await filters.getByRole('button', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/employmentType=/);
    await expect(page).not.toHaveURL(/industry=/);
  });

  test('home page search navigates to results', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-keyword').fill('sales');
    await page.getByTestId('home-search').click();
    await expect(page).toHaveURL(/\/jobs\?q=sales/);
    await expect(page.getByTestId('results-count')).toBeVisible();
  });

  test('industry page links to filtered jobs', async ({ page }) => {
    await page.goto('/industries');
    await page.getByTestId('industry-card').first().click();
    await expect(page).toHaveURL(/\/industries\/[a-z0-9-]+$/);
    await page.getByRole('link', { name: 'View all jobs' }).click();
    await expect(page).toHaveURL(/\/jobs\?industry=/);
  });
});
