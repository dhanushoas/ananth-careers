import { expect, test } from '@playwright/test';
import { AccountKey, expectNoHorizontalScroll, login } from './helpers';

const WIDTHS = [360, 768, 1024, 1440];

const PUBLIC_PAGES = ['/', '/jobs', '/industries', '/job-seekers', '/for-employers', '/process', '/contact', '/auth/login', '/auth/register/candidate', '/auth/register/employer'];

const PORTALS: Record<AccountKey, string[]> = {
  candidate: ['/candidate', '/candidate/profile', '/candidate/applications', '/candidate/settings'],
  employer: ['/employer', '/employer/requirements', '/employer/requirements/new', '/employer/candidates'],
  recruiter: ['/recruiter', '/recruiter/candidates', '/recruiter/requirements', '/recruiter/submissions', '/recruiter/pipeline'],
  admin: ['/admin', '/admin/shortlists', '/admin/recruiters', '/admin/reports', '/admin/settings'],
};

async function checkPages(page: import('@playwright/test').Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    await page.setViewportSize({ width: WIDTHS[0], height: 800 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(250);
      await expectNoHorizontalScroll(page, `${path} @${width}px`);
    }
  }
}

test.describe('Responsive layout (360 / 768 / 1024 / 1440)', () => {
  test('public pages have no horizontal scroll', async ({ page }) => {
    test.setTimeout(120_000);
    await checkPages(page, PUBLIC_PAGES);
  });

  for (const role of Object.keys(PORTALS) as AccountKey[]) {
    test(`${role} portal pages have no horizontal scroll`, async ({ page }) => {
      test.setTimeout(120_000);
      await login(page, role);
      await checkPages(page, PORTALS[role]);
    });
  }
});

test.describe('Mobile navigation (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('public drawer opens and closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'For Job Seekers' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('job filters open in a panel on mobile', async ({ page }) => {
    await page.goto('/jobs');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByTestId('job-filters')).toBeVisible();
    await page.getByRole('button', { name: 'Show results' }).click();
    await expect(page.getByTestId('job-filters')).toBeHidden();
    await expectNoHorizontalScroll(page, '/jobs drawer');
  });

  test('recruiter portal navigation is an offcanvas drawer', async ({ page }) => {
    await login(page, 'recruiter');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('link', { name: 'Candidate database' })).toBeVisible();
    await page.getByRole('link', { name: 'Candidate database' }).click();
    await expect(page).toHaveURL(/\/recruiter\/candidates/);
  });
});
