import { Page, Route } from '@playwright/test';
import { FakeGoogleTasksStub } from '../../src/app/fixtures/fake-google-tasks-stub';
import { PartnerSettingsDto } from '../../src/app/models/pulse.models';

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

/**
 * Installs a deterministic FakeGoogleTasksStub on `/api/v1/pulse/**` so Playwright
 * E2E journeys run identically against `ng serve` and remote PR preview URLs
 * without real Google credentials or a live Spring Boot backend.
 */
export async function installPulseApiStub(
  page: Page,
  options?: { userEmail?: string }
): Promise<FakeGoogleTasksStub> {
  const stub = new FakeGoogleTasksStub(options);

  await page.route('**/api/v1/pulse/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path.endsWith('/api/v1/pulse/state')) {
      return fulfillJson(route, stub.getState());
    }

    if (method === 'POST' && path.endsWith('/api/v1/pulse/tasks/swap')) {
      const payload = request.postDataJSON() as { toRemoveTaskId: string; toAddTaskId: string };
      return fulfillJson(route, stub.swapTop3(payload.toRemoveTaskId, payload.toAddTaskId));
    }

    const triageMatch = path.match(/\/api\/v1\/pulse\/tasks\/([^/]+)\/triage$/);
    if (method === 'POST' && triageMatch) {
      const taskId = decodeURIComponent(triageMatch[1]);
      const payload = request.postDataJSON() as {
        action: string;
        waitingOn?: string;
        postponeDays?: number;
      };
      return fulfillJson(
        route,
        stub.triageTask(taskId, payload.action, payload.waitingOn, payload.postponeDays)
      );
    }

    const chatMatch = path.match(/\/api\/v1\/pulse\/tasks\/([^/]+)\/chat$/);
    if (method === 'POST' && chatMatch) {
      const taskId = decodeURIComponent(chatMatch[1]);
      const payload = request.postDataJSON() as { message: string };
      return fulfillJson(route, stub.sendChatMessage(taskId, payload.message));
    }

    if (method === 'PUT' && path.endsWith('/api/v1/pulse/settings')) {
      const payload = request.postDataJSON() as PartnerSettingsDto;
      return fulfillJson(route, stub.updateSettings(payload));
    }

    if (method === 'POST' && path.endsWith('/api/v1/pulse/demo/reset')) {
      return fulfillJson(route, stub.resetDemo());
    }

    return route.continue();
  });

  return stub;
}
