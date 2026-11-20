import { expect, test } from '@playwright/test';
import { installPulseApiStub } from './support/pulse-e2e-harness';

test.describe("Journey 2: Setting Today's Top 3 & Scarcity Swap Gate", () => {
  test('pins 3 tasks, triggers 3/3 swap dialog on 4th pin, swaps, and unpins', async ({ page }) => {
    await installPulseApiStub(page);

    await page.goto('/');

    const counter = page.locator('.top3-counter');
    await expect(counter).toHaveText('0 / 3 Locked');

    const pinBtn = page.getByRole('button', {
      name: "Commit or Unpin selected task in Today's Top 3"
    });

    // Pin #1: Consolidate Q3 expense receipts & CPA export (selected by default)
    await pinBtn.click();
    await expect(counter).toHaveText('1 / 3 Locked');
    await expect(page.locator('.top3-slot.filled').first()).toContainText(
      'Consolidate Q3 expense receipts & CPA export'
    );

    // Pin #2: Call clinic to reschedule annual dental checkup
    await page.locator('.bar-row', { hasText: 'Call clinic to reschedule annual dental checkup' }).click();
    await pinBtn.click();
    await expect(counter).toHaveText('2 / 3 Locked');

    // Pin #3: Write Spring Boot 4 + Angular 21 architecture RFC
    await page.locator('.bar-row', { hasText: 'Write Spring Boot 4 + Angular 21 architecture RFC' }).click();
    await pinBtn.click();
    await expect(counter).toHaveText('3 / 3 Locked');

    // Switch to Long-Standing Drift tab and attempt to pin a 4th task
    await page.getByRole('tab', { name: /Drifting \(2\)/ }).click();
    await page.locator('.bar-row', { hasText: 'Renew passport photo & mail DS-82 form' }).click();
    await pinBtn.click();

    // Scarcity Swap Dialog must appear
    const swapDialog = page.getByRole('dialog', { name: 'Swap Top 3 Commitment' });
    await expect(swapDialog).toBeVisible();
    await expect(swapDialog).toContainText("Today's Top 3 is Full (3/3 Scarcity Cap)");

    // Swap out the RFC task for Renew passport photo
    await swapDialog
      .getByRole('button', { name: /Swap out "Write Spring Boot 4 \+ Angular 21 architecture RFC"/ })
      .click();

    await expect(swapDialog).toBeHidden();
    await expect(counter).toHaveText('3 / 3 Locked');
    await expect(page.locator('.top3-slots')).toContainText('Renew passport photo & mail DS-82 form');
    await expect(page.locator('.top3-slots')).not.toContainText(
      'Write Spring Boot 4 + Angular 21 architecture RFC'
    );

    // Unpin one Top-3 slot via clicking the filled slot then Unpin
    await page.locator('.top3-slot.filled', { hasText: 'Renew passport photo' }).click();
    await expect(pinBtn).toHaveText('Unpin Top 3');
    await pinBtn.click();
    await expect(counter).toHaveText('2 / 3 Locked');
  });
});
