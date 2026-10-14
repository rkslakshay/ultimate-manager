import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

/** Register, create a seeded career and land on the choose-club screen. */
async function startCareer(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('World Tester');
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill(`pw-${randomUUID().slice(0, 8)}-1`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  const dialog = page.getByRole('dialog', { name: 'New career' });
  await dialog.getByLabel('World seed (optional)').fill('e2e-world');
  await dialog.getByRole('button', { name: 'Start career' }).click();
  await expect(page).toHaveURL(/\/choose-club$/);
}

test('choose a club, browse squad, player, league, search and editor', async ({ page }) => {
  await startCareer(page);

  // Pick the second division's first club (a modest job).
  await page.getByRole('tab', { name: 'Ardenian First Division' }).click();
  const firstClub = page.getByRole('row').nth(1);
  const clubName = (await firstClub.getByRole('cell').first().innerText())
    .replace(/^[A-Z]{2,4}\s*/, '')
    .trim();
  await firstClub.click();
  await page.getByRole('button', { name: 'Accept job' }).click();
  await expect(page).toHaveURL(/\/club$/);
  await expect(page.getByRole('heading', { name: clubName, level: 2 })).toBeVisible();
  await expect(page.getByText('Your club')).toBeVisible();
  await page.screenshot({ path: 'test-results/p1-club.png', fullPage: true });

  // Squad table → player profile.
  await page
    .getByRole('navigation', { name: 'Game sections' })
    .getByRole('link', { name: 'Squad', exact: true })
    .click();
  const squadRows = page.getByRole('table', { name: 'Your squad' }).getByRole('row');
  // Header row + at least 24 players.
  await expect(squadRows.nth(24)).toBeVisible();
  await squadRows.nth(1).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/players\/\d+$/);
  await expect(
    page
      .getByRole('heading', { name: 'Technical' })
      .or(page.getByRole('heading', { name: 'Goalkeeping' })),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Positions the player can play' })).toBeVisible();
  await page.screenshot({ path: 'test-results/p1-player.png', fullPage: true });

  // League table shows our club.
  await page
    .getByRole('navigation', { name: 'Game sections' })
    .getByRole('link', { name: 'League', exact: true })
    .click();
  await expect(
    page.getByRole('table', { name: 'League table' }).getByRole('link', { name: clubName }),
  ).toBeVisible();

  // Search: goalkeepers aged 18-21, sorted by value.
  await page
    .getByRole('navigation', { name: 'Game sections' })
    .getByRole('link', { name: 'Search', exact: true })
    .click();
  await page.getByLabel('Position').selectOption('GK');
  await page.getByLabel('Minimum age').fill('18');
  await page.getByLabel('Maximum age').fill('21');
  const results = page.getByRole('table', { name: 'Player search results' });
  await expect(results.getByRole('row').nth(1)).toContainText('GK');
  await expect(page.getByText(/Players · \d+ found/)).toBeVisible();
  await page.screenshot({ path: 'test-results/p1-search.png', fullPage: true });

  // Editor: rename our club, then see the new name in the top bar.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Database editor' }).click();
  await page.getByRole('textbox', { name: 'Filter clubs…' }).fill(clubName);
  await page.getByRole('button', { name: `Edit ${clubName}` }).click();
  const edit = page.getByRole('dialog', { name: `Edit ${clubName}` });
  await edit.getByLabel('Name', { exact: true }).fill('Glory Town FC');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Club updated')).toBeVisible();
  await expect(page.locator('header').getByText('Glory Town FC')).toBeVisible();
});

test('player search pages through results on the server', async ({ page }) => {
  await startCareer(page);
  await page.goto(page.url().replace('/choose-club', '/search'));
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  const firstName = await page
    .getByRole('table', { name: 'Player search results' })
    .getByRole('row')
    .nth(1)
    .innerText();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Player search results' }).getByRole('row').nth(1),
  ).not.toHaveText(firstName);
});
