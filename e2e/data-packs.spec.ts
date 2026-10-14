import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// Uses the "sample" pack built from the committed FICTIONAL fixture dataset
// (npm run data:import -- --pack sample). It exercises the same code path as the real pack.

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Pack Tester');
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill(`pw-${randomUUID().slice(0, 8)}-1`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/saves$/);
}

async function newPackCareer(page: Page) {
  await page.getByRole('button', { name: 'New career' }).click();
  const dialog = page.getByRole('dialog', { name: 'New career' });
  // The radio is visually hidden; users click the whole option card (its label).
  await dialog.getByText('Sample (fictional test fixture)').click();
  await expect(
    dialog.getByRole('radio', { name: /Sample \(fictional test fixture\)/ }),
  ).toBeChecked();
  await expect(dialog.getByText(/personal, non-commercial use only/)).toBeVisible();
  await dialog.getByLabel('Save name').fill('Pack career');
  await dialog.getByRole('button', { name: 'Start career' }).click();
  await expect(page).toHaveURL(/\/choose-club$/);
  return page.url().split('/game/')[1]!.split('/')[0]!;
}

test('new save from a data pack → choose a club → squad → player with provenance and transfer history', async ({
  page,
}) => {
  await register(page);
  const saveId = await newPackCareer(page);

  await page.getByRole('tab', { name: 'Northland Premier' }).click();
  await page.getByRole('table', { name: 'Clubs you can manage' }).getByRole('row').nth(1).click();
  await page.getByRole('button', { name: 'Accept job' }).click();
  await expect(page).toHaveURL(/\/club$/);

  // Squad: real players plus clearly marked generated fillers.
  await page
    .getByRole('navigation', { name: 'Game sections' })
    .getByRole('link', { name: 'Squad', exact: true })
    .click();
  const squad = page.getByRole('table', { name: 'Your squad' });
  await expect(squad.getByRole('row').nth(18)).toBeVisible();
  await expect(squad.getByText('gen').first()).toBeVisible();

  // Find (via the API) a player of this club who has historical transfers, then open him in the UI.
  const save = await (await page.request.get(`/api/saves/${saveId}`)).json();
  const club = await (
    await page.request.get(`/api/saves/${saveId}/world/clubs/${save.managerClubId}`)
  ).json();
  let target: { id: number; lastName: string } | null = null;
  for (const p of club.squad.filter((x: { origin: string }) => x.origin === 'imported')) {
    const h = await (
      await page.request.get(`/api/saves/${saveId}/world/players/${p.id}/history`)
    ).json();
    if (h.transfers.length && h.valuations.length) {
      target = p;
      break;
    }
  }
  expect(target).not.toBeNull();
  await squad
    .getByRole('link', { name: new RegExp(target!.lastName) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/players/${target!.id}$`));

  await expect(page.getByText('Real player')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source data', exact: true })).toBeVisible();
  await expect(page.getByText(/Source ratings: overall \d+/)).toBeVisible();
  await expect(page.getByText('Market value history')).toBeVisible();
  await expect(page.getByRole('img', { name: /Market value from/ })).toBeVisible();
  const transfers = page.getByRole('table', { name: 'Historical transfers' });
  await expect(transfers.getByRole('row').nth(1)).toContainText('Old Harbour FC');
  await page.screenshot({ path: 'test-results/pack-player.png', fullPage: true });
});

test('database editor adds a custom player to the squad', async ({ page }) => {
  await register(page);
  const saveId = await newPackCareer(page);
  await page.getByRole('table', { name: 'Clubs you can manage' }).getByRole('row').nth(1).click();
  await page.getByRole('button', { name: 'Accept job' }).click();
  await expect(page).toHaveURL(/\/club$/);

  await page.goto(`/game/${saveId}/editor`);
  await page.getByRole('tab', { name: 'Players' }).click();
  await page.getByRole('button', { name: 'Add player' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add player' });
  await dialog.getByLabel('Last name').fill('Customson');
  await dialog.getByLabel('Nationality').selectOption({ index: 1 });
  await dialog.getByLabel('Position').selectOption('ST');
  await dialog.getByLabel('Club').selectOption({ index: 1 });
  await dialog.getByLabel('Ability (1-200)').fill('140');
  await dialog.getByRole('button', { name: 'Add player' }).click();
  await expect(page.getByText(/Added .*Customson \(ability \d+\)/)).toBeVisible();

  await page.goto(`/game/${saveId}/search`);
  await page.getByLabel('Name').fill('Customson');
  await expect(
    page
      .getByRole('table', { name: 'Player search results' })
      .getByRole('link', { name: /Customson/ }),
  ).toBeVisible();
});
