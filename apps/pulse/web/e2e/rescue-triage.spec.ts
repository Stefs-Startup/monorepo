import { expect, test } from '@playwright/test';
import { installPulseApiStub } from './support/pulse-e2e-harness';

test.describe('Journey 3: Left-Undone Rescue Triage', () => {
  test('shrinks a habitual task to 5m starter and triages undone log items (reschedule, park, complete)', async ({
    page
  }) => {
    await installPulseApiStub(page);

    await page.goto('/');

    // 1. Shrink habitually deferred task from Horizon Inspector
    const inspector = page.getByLabel('Selected Task Inspector');
    await expect(inspector).toContainText('Consolidate Q3 expense receipts & CPA export');
    await page.getByRole('button', { name: 'Shrink selected task to 5 minute starter' }).click();
    await expect(inspector).toContainText('5m starter: Consolidate Q3 expense receipts & CPA export');

    // 2. Navigate to Undone Log Audit Trail
    await page.getByRole('button', { name: /Undone Log/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Undone Log' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Habitually Undone \(Deferred 2×\+\) • 3/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Long-Standing Drift \(5d\+ Untouched \/ Overdue\) • 2/ })
    ).toBeVisible();

    // 3. Reschedule a habitually deferred task to tomorrow (increments defer count)
    const dentistCard = page.locator('article.stalled-card', {
      hasText: 'Call clinic to reschedule annual dental checkup'
    });
    await expect(dentistCard).toContainText('Deferrals: 4×');
    await dentistCard.getByRole('button', { name: 'Defer task to tomorrow' }).click();
    await expect(dentistCard).toContainText('Deferrals: 5×');

    // 4. Park a drifting task in Someday (removes from Long-Standing Drift)
    const billingCard = page.locator('article.stalled-card', {
      hasText: 'Audit Cloud Run preview budget alerts'
    });
    await billingCard.getByRole('button', { name: 'Park task in Someday' }).click();
    await expect(billingCard).toBeHidden();
    await expect(
      page.getByRole('heading', { name: /Long-Standing Drift \(5d\+ Untouched \/ Overdue\) • 1/ })
    ).toBeVisible();

    // 5. Mark the remaining drifting task completed
    const passportCard = page.locator('article.stalled-card', {
      hasText: 'Renew passport photo & mail DS-82 form'
    });
    await passportCard.getByRole('button', { name: 'Mark task completed' }).click();
    await expect(passportCard).toBeHidden();
    await expect(
      page.getByRole('heading', { name: /Long-Standing Drift \(5d\+ Untouched \/ Overdue\) • 0/ })
    ).toBeVisible();
  });
});
