import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Tailspin Toys - Crowdfunding your new favorite game!');
  });

  test('should display the main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to Tailspin Toys', exact: true })).toBeVisible();
  });

  test('should display the site branding in header', async ({ page }) => {
    await expect(page.getByText('Tailspin Toys').first()).toBeVisible();
  });

  test('should display the welcome message', async ({ page }) => {
    await expect(page.getByText('Find your next game! And maybe even back one! Explore our collection!')).toBeVisible();
  });

  test('should filter by category and publisher together', async ({ page }) => {
    const categoryFilter = page.getByTestId('category-filter');
    const publisherFilter = page.getByTestId('publisher-filter');

    await categoryFilter.selectOption({ label: 'Strategy' });
    await publisherFilter.selectOption({ label: 'CodeForge Studios' });
    await page.getByTestId('apply-filters').click();

    const visibleCards = page.locator('[data-testid="game-card"]').filter({ has: page.locator(':visible') });
    await expect(visibleCards).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'DevOps Dominion', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pipeline Conquest', exact: true })).not.toBeVisible();
  });

  test('should show the empty state when no games match a filter combination', async ({ page }) => {
    await page.goto('/?category=99999&publisher=99999');

    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('empty-state-text')).toHaveText('No games match the selected filters.');
  });
});
