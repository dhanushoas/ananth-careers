import { expect, test, Page } from '@playwright/test';
import { confirmDialog, futureDate, futureDateTimeLocal, login, logout, toast } from './helpers';

/**
 * End-to-end consultancy flow (contract v2):
 * recruiter matches & shortlists → admin approves → recruiter submits to the company →
 * employer reviews (no contact details) and requests an interview → recruiter schedules →
 * employer accepts → recruiter marks the candidate as placed.
 *
 * The backend persists data, so the spec picks any Northwind requirement/candidate pair that is
 * still available and skips (with a reason) if the demo pool is exhausted.
 */
test.describe.serial('Veejee Services recruitment flow', () => {
  let candidateName = '';
  let requirementTitle = '';
  let requirementUrl = '';

  async function openRequirementWithShortlistableMatch(page: Page): Promise<boolean> {
    await page.goto('/recruiter/requirements?status=published');
    const rows = page.getByTestId('requirement-row').filter({ hasText: 'Northwind' });
    await expect(rows.first()).toBeVisible();
    const hrefs = await rows.locator('a[href*="/recruiter/requirements/"]').evaluateAll((links) =>
      [...new Set(links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean),
    );
    for (const href of hrefs) {
      await page.goto(href);
      await page.getByRole('tab', { name: 'Candidate matching' }).click();
      const consentSwitch = page.getByLabel('Consented profiles only');
      if (!(await consentSwitch.isChecked())) {
        await consentSwitch.check();
      }
      const candidates = page.getByTestId('match-row').filter({ hasText: 'Profile sharing consented' });
      await page.waitForLoadState('networkidle');
      const count = await candidates.count();
      for (let i = 0; i < count; i++) {
        const row = candidates.nth(i);
        const button = row.getByRole('button', { name: 'Shortlist', exact: true });
        if (await button.isEnabled()) {
          requirementUrl = page.url().split('?')[0];
          requirementTitle = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
          candidateName = (await row.locator('h3, .name, strong').first().innerText()).trim();
          await button.click();
          await expect(toast(page, 'Candidate shortlisted')).toBeVisible();
          return true;
        }
      }
    }
    return false;
  }

  test('recruiter searches the candidate database and shortlists a matched candidate', async ({ page }) => {
    await login(page, 'recruiter');
    await page.goto('/recruiter/candidates');
    await page.getByTestId('candidate-search-q').fill('developer');
    await page.getByTestId('candidate-search-q').press('Enter');
    await expect(page).toHaveURL(/[?&]q=developer/);
    await expect(page.getByTestId('candidate-row').first()).toBeVisible();

    const found = await openRequirementWithShortlistableMatch(page);
    test.skip(!found, 'No consented, un-shortlisted candidate left for Northwind requirements in this database.');
    expect(candidateName.length).toBeGreaterThan(0);
  });

  test('admin approves the pending shortlist', async ({ page }) => {
    test.skip(!candidateName, 'Previous step skipped');
    await login(page, 'admin');
    await page.goto('/admin/shortlists');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const row = page.getByTestId('shortlist-row').filter({ hasText: candidateName }).first();
    // Approval may be disabled in System settings; then the shortlist is already approved.
    if ((await row.count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'No pending shortlist (approval not required).' });
      return;
    }
    await row.getByRole('button', { name: 'Approve', exact: true }).click();
    await confirmDialog(page, 'Approve');
    await expect(toast(page, 'Shortlist approved')).toBeVisible();
  });

  test('recruiter submits the candidate to the company without contact details', async ({ page }) => {
    test.skip(!candidateName, 'Previous step skipped');
    await login(page, 'recruiter');
    await page.goto(`${requirementUrl}?tab=shortlist`);
    await page.getByRole('tab', { name: 'Shortlist' }).click();
    const item = page.getByTestId('shortlist-item').filter({ hasText: candidateName }).first();
    await item.getByRole('button', { name: 'Submit to company' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Summary for the company').fill('E2E: strong match on core skills, available within 30 days.');
    const share = dialog.getByLabel('Share contact details');
    if (await share.isChecked()) {
      await share.uncheck();
    }
    await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(toast(page, 'Submitted to company')).toBeVisible();
  });

  test('employer reviews the submitted candidate (no contact details) and requests an interview', async ({ page }) => {
    test.skip(!candidateName, 'Previous step skipped');
    await login(page, 'employer');
    await page.goto('/employer/candidates');
    const row = page.getByTestId('submitted-candidate-row').filter({ hasText: candidateName }).first();
    await row.getByRole('link', { name: candidateName }).click();
    await expect(page).toHaveURL(/\/employer\/candidates\/[^/]+$/);
    await expect(page.getByRole('heading', { name: candidateName }).first()).toBeVisible();
    await expect(page.getByTestId('candidate-contact')).toHaveCount(0);

    await page.getByRole('button', { name: 'Request interview' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Note for Veejee Services').fill('E2E: weekday mornings preferred.');
    await dialog.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page, 'Interview requested')).toBeVisible();
  });

  test('recruiter schedules the interview', async ({ page }) => {
    test.skip(!candidateName, 'Previous step skipped');
    await login(page, 'recruiter');
    await page.goto('/recruiter/submissions');
    await page.getByTestId('submission-row').filter({ hasText: candidateName }).first().getByRole('link', { name: candidateName }).click();
    await expect(page).toHaveURL(/\/recruiter\/submissions\/[^/]+$/);
    await page.getByRole('button', { name: 'Schedule interview' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Date & time').fill(futureDateTimeLocal(3));
    await dialog.getByLabel('Duration (minutes)').fill('45');
    await dialog.getByLabel('Mode').selectOption('video');
    await dialog.getByLabel('Meeting link').fill('https://meet.example.com/veejee-e2e');
    await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(toast(page, 'Interview scheduled')).toBeVisible();
  });

  test('employer accepts the candidate', async ({ page }) => {
    test.skip(!candidateName, 'Previous step skipped');
    await login(page, 'employer');
    await page.goto('/employer/candidates');
    await page.getByTestId('submitted-candidate-row').filter({ hasText: candidateName }).first().getByRole('link', { name: candidateName }).click();
    await page.getByRole('button', { name: 'Accept candidate' }).click();
    await confirmDialog(page, 'Accept');
    await expect(toast(page, 'Candidate accepted')).toBeVisible();
  });

  test('recruiter marks the candidate as successfully placed', async ({ page }) => {
    test.skip(!candidateName, 'Previous step skipped');
    await login(page, 'recruiter');
    await page.goto('/recruiter/submissions');
    await page.getByTestId('submission-row').filter({ hasText: candidateName }).first().getByRole('link', { name: candidateName }).click();
    await page.getByLabel('New status').selectOption('placed');
    await page.getByLabel('Joining date').fill(futureDate(30));
    await page.getByRole('button', { name: 'Update status' }).click();
    await confirmDialog(page, 'Update');
    await expect(toast(page, 'Status updated')).toBeVisible();
    await logout(page);
  });
});
