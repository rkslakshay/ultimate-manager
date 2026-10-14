import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// Generated per run; these accounts only ever exist in the local/CI dev database.
const newAccount = () => ({
  displayName: 'E2E Manager',
  email: `e2e-${randomUUID()}@example.test`,
  password: `e2e-${randomUUID().slice(0, 8)}-1`,
});

async function register(page: Page, account = newAccount()) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill(account.displayName);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/saves$/);
  return account;
}

test('redirects anonymous visitors to sign in', async ({ page }) => {
  await page.goto('/game/anything/inbox');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('shows validation errors on the registration form', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
});

test('register → create save → navigate shell → sign out → sign in → delete save', async ({
  page,
}) => {
  const account = await register(page);

  // Create a career.
  await page.getByRole('button', { name: 'New career' }).click();
  const dialog = page.getByRole('dialog', { name: 'New career' });
  await dialog.getByLabel('Save name').fill('E2E Career');
  await dialog.getByLabel('World seed (optional)').fill('e2e-seed');
  await dialog.getByRole('button', { name: 'Start career' }).click();

  // Game shell: top bar, date, sidebar.
  await expect(page).toHaveURL(/\/game\/[^/]+\/inbox$/);
  await expect(page.getByRole('heading', { name: 'Inbox', level: 2 })).toBeVisible();
  await expect(page.getByLabel('Current in-game date')).toHaveText('Wed, 1 Jul 2026');
  await expect(page.getByText('e2e-seed')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Game sections' });
  for (const section of ['Squad', 'Tactics', 'Transfers', 'Finances', 'League', 'Search']) {
    await nav.getByRole('link', { name: section, exact: true }).click();
    await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible();
    await expect(nav.getByRole('link', { name: section, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
  await page.screenshot({ path: 'test-results/shell.png' });

  // Keyboard: g then f jumps to Finances; Space triggers Continue.
  await page.locator('main').click();
  await page.keyboard.press('g');
  await page.keyboard.press('f');
  await expect(page.getByRole('heading', { name: 'Finances', level: 2 })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('Time advancement arrives with the season loop')).toBeVisible();

  // Sign out, then back in: the save is still there.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/saves$/);
  const row = page.getByRole('row', { name: /E2E Career/ });
  await expect(row).toBeVisible();
  await page.screenshot({ path: 'test-results/saves.png' });

  // Delete it.
  await row.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete save' }).click();
  await expect(page.getByText('No careers yet')).toBeVisible();
});

test('sign-in rejects a wrong password', async ({ page }) => {
  const account = await register(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');
});
