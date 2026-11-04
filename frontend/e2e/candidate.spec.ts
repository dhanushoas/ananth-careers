import { expect, test } from '@playwright/test';
import { login, openFirstApplicableJob, toast } from './helpers';

test.describe('Candidate portal', () => {
  test('dashboard shows the 15-stage tracker and consent status', async ({ page }) => {
    await login(page, 'candidate');
    await expect(page.getByTestId('stage-tracker')).toBeVisible();
    await expect(page.getByTestId('consent-badges').first()).toBeVisible();
  });

  test('profile can be saved', async ({ page }) => {
    await login(page, 'candidate');
    await page.goto('/candidate/profile');
    await page.getByRole('button', { name: 'Save profile' }).first().click();
    await expect(toast(page, 'Profile saved')).toBeVisible();
  });

  test('privacy & consent: contact sharing can be turned off and on again', async ({ page }) => {
    await login(page, 'candidate');
    await page.goto('/candidate/settings');
    const profile = page.getByLabel('Share my profile with client companies');
    const contact = page.getByLabel('Share my contact details with client companies');
    await expect(profile).toBeVisible();
    if (!(await profile.isChecked())) {
      await profile.check();
      await expect(toast(page, 'Privacy preferences updated')).toBeVisible();
    }
    const wasOn = await contact.isChecked();
    await contact.setChecked(!wasOn);
    await expect(toast(page, 'Privacy preferences updated').first()).toBeVisible();
    await contact.setChecked(wasOn);
    await expect(contact).toBeChecked({ checked: wasOn });
  });

  test('candidate applies through Veejee Services and sees the application', async ({ page }) => {
    await login(page, 'candidate');
    const href = await openFirstApplicableJob(page, '/jobs?sort=latest');
    test.skip(href === null, 'The demo candidate has already applied to every listed job.');
    const title = (await page.getByTestId('job-title').innerText()).trim();
    await page.getByTestId('apply-button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('submit-application').click();
    await expect(toast(page, /Application submitted to Veejee Services|already applied/i)).toBeVisible();

    await page.goto('/candidate/applications');
    await expect(page.getByTestId('application-item').filter({ hasText: title }).first()).toBeVisible();
  });

  test('old /seeker links redirect to the candidate portal', async ({ page }) => {
    await login(page, 'candidate');
    await page.goto('/seeker/applications');
    await expect(page).toHaveURL(/\/candidate\/applications/);
  });
});
