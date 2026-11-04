import { Page, expect } from '@playwright/test';

export const PASSWORD = process.env['E2E_PASSWORD'] ?? 'Veejee@2026';

export const ACCOUNTS = {
  admin: process.env['E2E_ADMIN'] ?? 'admin@veejee.example',
  recruiter: process.env['E2E_RECRUITER'] ?? 'recruiter@veejee.example',
  employer: process.env['E2E_EMPLOYER'] ?? 'employer@veejee.example',
  candidate: process.env['E2E_CANDIDATE'] ?? 'seeker@veejee.example',
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

const HOME: Record<AccountKey, RegExp> = {
  admin: /\/admin(\/|$|\?)/,
  recruiter: /\/recruiter(\/|$|\?)/,
  employer: /\/employer(\/|$|\?)/,
  candidate: /\/candidate(\/|$|\?)/,
};

/** Signs in through the UI and waits for the role's portal. */
export async function login(page: Page, who: AccountKey): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(ACCOUNTS[who]);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(HOME[who]);
}

export async function logout(page: Page): Promise<void> {
  await page.getByTestId('user-menu').click();
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/$/);
}

/** Picks an option (by visible label) from a native <select> identified by its label. */
export async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByLabel(label, { exact: true }).selectOption({ label: option });
}

/** Picks the first real option (index 1, after the placeholder) of a native <select>. Returns its text. */
export async function selectFirstOption(page: Page, label: string): Promise<string> {
  const select = page.getByLabel(label, { exact: true });
  const text = (await select.locator('option').nth(1).innerText()).trim();
  await select.selectOption({ index: 1 });
  return text;
}

export function toast(page: Page, text: string | RegExp) {
  return page.getByTestId('toast').filter({ hasText: text });
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/** Confirms the open ConfirmService dialog with the given button text. */
export async function confirmDialog(page: Page, button: string, reason?: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (reason) {
    await dialog.locator('textarea').fill(reason);
  }
  await dialog.getByRole('button', { name: button, exact: true }).click();
}

/** `yyyy-MM-ddTHH:mm` for a local datetime `days` from now at 10:30. */
export function futureDateTimeLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 30, 0, 0);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function futureDate(days: number): string {
  return futureDateTimeLocal(days).slice(0, 10);
}

/** Horizontal overflow check: the document must not be wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page, context = ''): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${context} is ${scrollWidth}px wide in a ${clientWidth}px viewport`).toBeLessThanOrEqual(clientWidth);
}

/** Visits job detail pages from a listing until one offers "Apply through Veejee Services". */
export async function openFirstApplicableJob(page: Page, listUrl: string, max = 24): Promise<string | null> {
  await page.goto(listUrl);
  await expect(page.getByTestId('job-card').first()).toBeVisible();
  const hrefs = await page
    .getByTestId('job-card')
    .locator('h3 a')
    .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
  for (const href of hrefs.slice(0, max)) {
    await page.goto(href);
    await expect(page.getByTestId('apply-panel')).toBeVisible();
    const apply = page.getByTestId('apply-button');
    if ((await apply.count()) > 0 && (await apply.isEnabled())) {
      return href;
    }
  }
  return null;
}
