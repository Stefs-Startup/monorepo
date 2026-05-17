import { test, expect } from '@playwright/test';

test.describe('TechDocs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const guestSignIn = page.getByRole('button', { name: 'Enter' }).or(page.getByRole('button', { name: 'Guest' }));
    if (await guestSignIn.isVisible()) {
      await guestSignIn.click();
    }
  });

  test('should render TechDocs index', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { name: 'Documentation' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should render cmp-monorepo documentation', async ({ page }) => {
    await page.goto('/docs/default/system/cmp-monorepo');
    await expect(page.getByRole('heading', { name: 'Documentation' }).first()).toBeVisible({ timeout: 20000 });
  });

  test('should render backstage component documentation', async ({ page }) => {
    await page.goto('/docs/default/component/backstage');
    await expect(page.getByRole('heading', { name: 'Documentation' }).first()).toBeVisible({ timeout: 20000 });
  });

  test('should render cmp-monorepo architecture subpage', async ({ page }) => {
    await page.goto('/docs/default/system/cmp-monorepo/monorepo-conventions');
    await expect(page.getByRole('heading', { name: 'Monorepo Conventions' }).first()).toBeVisible({ timeout: 20000 });
  });

  test('should render cmp-monorepo ADR subpage', async ({ page }) => {
    await page.goto('/docs/default/system/cmp-monorepo/adr/0001-use-pnpm-workspaces');
    await expect(page.getByRole('heading', { name: /ADR-0001: Use pnpm Workspaces/ }).first()).toBeVisible({ timeout: 20000 });
  });

  test('should render cmp-web documentation', async ({ page }) => {
    await page.goto('/docs/default/component/cmp-web');
    await expect(page.getByRole('heading', { name: 'CMP Web' }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Architecture' }).first()).toBeVisible();
  });

  test('should render infra documentation', async ({ page }) => {
    await page.goto('/docs/default/resource/cmp-postgres');
    await expect(page.getByRole('heading', { name: 'Infrastructure' }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'PostgreSQL' }).first()).toBeVisible();
  });

  test('should render cmp-config documentation', async ({ page }) => {
    await page.goto('/docs/default/component/cmp-config');
    await expect(page.getByRole('heading', { name: 'CMP Config' }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Configuration' }).first()).toBeVisible();
  });

  test('should render cmp-utils documentation', async ({ page }) => {
    await page.goto('/docs/default/component/cmp-utils');
    await expect(page.getByRole('heading', { name: 'CMP Utils' }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Usage' }).first()).toBeVisible();
  });
});
