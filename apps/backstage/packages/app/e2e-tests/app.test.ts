/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test';

test('App should render the welcome page', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Page Error: ${msg.text()}`);
    }
  });

  await page.goto('/');

  // Wait for the page to load and check if we're redirected to catalog or stay on sign-in
  await expect(page).toHaveURL(/\/catalog|(?:\/)$/);

  // If we're on the sign-in page, click Guest
  const guestSignIn = page.getByRole('button', { name: 'Enter' }).or(page.getByRole('button', { name: 'Guest' }));
  if (await guestSignIn.isVisible()) {
    await guestSignIn.click();
  }

  await expect(page.getByText('My Company Catalog')).toBeVisible({ timeout: 10000 });
});
