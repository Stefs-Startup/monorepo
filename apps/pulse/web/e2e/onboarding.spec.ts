import { expect, test } from '@playwright/test';
import { installPulseApiStub } from './support/pulse-e2e-harness';

test.describe('Journey 1: Onboarding, Google Tasks Sync & Settings', () => {
  test('connects to deterministic seed state, verifies Google Tasks sync, updates persona & theme', async ({
    page
  }) => {
    await installPulseApiStub(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Horizon' })).toBeVisible();
    await expect(page.locator('.connection-pill')).toHaveText('Spring Boot 4 Live');
    await expect(page.getByRole('status')).toContainText('Ready • 3 Horizon Windows');

    // Verify 3 Horizon analytical window tabs render with seeded counts
    await expect(page.getByRole('tab', { name: /Habitual \(3\)/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Drifting \(2\)/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Active \(1\)/ })).toBeVisible();

    // Toggle dark theme and verify attribute on <html>
    await page.getByRole('button', { name: 'Toggle Light or Dark Theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Navigate to Settings -> Google Tasks Sync
    await page.getByRole('button', { name: /Settings/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    await page.getByRole('button', { name: /Google Tasks Sync/ }).click();
    await expect(page.getByText('stefan@pulse.local')).toBeVisible();
    await expect(page.getByText('Synced • Google Tasks Stub v1')).toBeVisible();

    // Return to Settings Index -> Partner Persona & AI
    await page.getByRole('button', { name: 'Back to settings index' }).click();
    await page.getByRole('button', { name: /Partner Persona & AI/ }).click();
    await page.getByLabel('Partner Coaching Tone').selectOption('Direct & Minimalist');
    await expect(page.getByRole('status')).toContainText('Settings saved • Tone: Direct & Minimalist');

    // Return to Horizon and verify Sync button refreshes cleanly
    await page.getByRole('button', { name: /Horizon/ }).click();
    await page.getByRole('button', { name: 'Sync Google Tasks' }).click();
    await expect(page.locator('.connection-pill')).toHaveText('Spring Boot 4 Live');
  });
});
