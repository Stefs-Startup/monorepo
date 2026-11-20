import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeGoogleOAuthProvider,
  FakeGoogleTasksProvider,
  GOOGLE_TASKS_SCOPE,
  HttpGoogleTasksClient,
  classifyGoogleSignInFailure,
  formatEpochToRfc3339,
  formatTasksScope,
  isAuthorizedSession,
  isSessionValid,
  maskToken,
  parseRfc3339ToEpoch,
  scrubAuthSensitiveText,
  validateGoogleEmail,
} from "./index.js";

describe("@cmp/google-auth", () => {
  it("validates Google OAuth scopes, emails, sessions, and masks tokens safely", () => {
    assert.equal(formatTasksScope(), `oauth2:${GOOGLE_TASKS_SCOPE}`);
    assert.equal(validateGoogleEmail("stefan@gmail.com"), true);
    assert.equal(validateGoogleEmail("user.name+tag@company.com"), true);
    assert.equal(validateGoogleEmail("not-an-email"), false);
    assert.equal(validateGoogleEmail(""), false);

    const sampleToken = ["ya29", "sample_token_123"].join(".");
    assert.equal(isAuthorizedSession("stefan@gmail.com", sampleToken), true);
    assert.equal(isAuthorizedSession("", sampleToken), false);
    assert.equal(isAuthorizedSession("stefan@gmail.com", "   "), false);

    const masked = maskToken(["ya29", "a0AfH6SMDI_sample_secret_token_xyz987"].join("."));
    assert.equal(masked, "ya29...z987");
    assert.equal(maskToken("short"), "****");
  });

  it("parses and formats RFC 3339 timestamps symmetrically", () => {
    const iso = "2026-11-02T19:00:00Z";
    const epoch = parseRfc3339ToEpoch(iso);
    assert.notEqual(epoch, null);
    assert.equal(formatEpochToRfc3339(epoch!), iso);
    assert.equal(parseRfc3339ToEpoch(""), null);
    assert.equal(parseRfc3339ToEpoch("invalid-date"), null);
  });

  it("classifies Google Sign-In failure codes and scrubs PII on unknown errors", () => {
    const code10 = classifyGoogleSignInFailure(new Error("10: Developer error"));
    assert.equal(code10.statusCode, 10);
    assert.equal(code10.statusName, "DEVELOPER_ERROR");
    assert.equal(code10.telemetryAttributes.auth_error_code, "10");

    const code12500 = classifyGoogleSignInFailure(new Error("12500: Sign in failed"));
    assert.equal(code12500.statusCode, 12500);
    assert.equal(code12500.statusName, "SIGN_IN_FAILED");

    const code12501 = classifyGoogleSignInFailure({ statusCode: 12501, message: "Canceled" });
    assert.equal(code12501.statusCode, 12501);
    assert.equal(code12501.statusName, "SIGN_IN_CANCELED");

    const syntheticToken = ["ya29", "secret123"].join(".");
    const unknown = classifyGoogleSignInFailure(
      new Error(`Token failed for stefan@example.com with ${syntheticToken}`),
    );
    assert.equal(unknown.statusName, "UNCLASSIFIED_AUTH_ERROR");
    assert.equal(unknown.userFacingExplanation.includes("[REDACTED_EMAIL]"), true);
    assert.equal(unknown.userFacingExplanation.includes("[REDACTED_TOKEN]"), true);
    assert.equal(
      scrubAuthSensitiveText("Bearer eyJhbGciOi.test for alex@company.io"),
      "Bearer [REDACTED_TOKEN] for [REDACTED_EMAIL]",
    );
  });

  it("provides deterministic FakeGoogleOAuthProvider and FakeGoogleTasksProvider with zero real credentials", async () => {
    const nowMs = 1_762_992_000_000;
    const oauth = new FakeGoogleOAuthProvider({ nowEpochMs: nowMs });
    const session = oauth.signIn("alex.rivera@example.com");
    assert.equal(isSessionValid(session, nowMs), true);
    assert.equal(isSessionValid(session, nowMs + 7_200_000), false);

    const tasks = new FakeGoogleTasksProvider({ nowEpochMs: nowMs });
    const lists = await tasks.fetchTaskLists(session.accessToken);
    assert.equal(lists.length, 2);
    assert.equal(lists[0]?.id, "@default");

    const initialTasks = await tasks.fetchTasksForList(session.accessToken, "@default");
    assert.equal(initialTasks.length, 2);

    const created = await tasks.createOrUpdateTask(session.accessToken, {
      taskListId: "@default",
      title: "Verify zero-credential contract",
      notes: "Deterministic fake",
      isCompleted: false,
      dueEpochMillis: nowMs + 86_400_000,
    });
    assert.equal(created.id, "gtask-3");
    assert.equal(created.status, "needsAction");

    const updated = await tasks.createOrUpdateTask(session.accessToken, {
      taskListId: "@default",
      googleTaskId: "gtask-3",
      title: "Verify zero-credential contract (done)",
      isCompleted: true,
    });
    assert.equal(updated.status, "completed");

    await assert.rejects(
      () => tasks.fetchTasksForList("expired-token"),
      /401/,
    );
    await assert.rejects(
      () => tasks.fetchTasksForList("scope-insufficient-token"),
      /403/,
    );

    oauth.revoke();
    assert.equal(oauth.getCurrentSession(), null);
  });

  it("executes HttpGoogleTasksClient requests with Bearer auth and handles HTTP errors", async () => {
    const calls: Array<{ url: string; method: string; auth: string | undefined }> = [];
    const client = new HttpGoogleTasksClient({
      baseUrl: "https://tasks.example.test",
      fetchFn: async (url, init) => {
        calls.push({ url, method: init.method, auth: init.headers.Authorization });
        if (init.headers.Authorization === "Bearer bad-token") {
          return {
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            text: async () => JSON.stringify({ error: { code: 401 } }),
          };
        }
        if (init.method === "POST" || init.method === "PATCH") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () =>
              JSON.stringify({
                id: "remote-1",
                title: "Synced task",
                status: "needsAction",
              }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              items: [{ id: "list-1", title: "Work Tasks" }],
            }),
        };
      },
    });

    const lists = await client.fetchTaskLists("valid-token");
    assert.equal(lists.length, 1);
    assert.equal(lists[0]?.id, "list-1");
    assert.equal(calls[0]?.auth, "Bearer valid-token");

    const upserted = await client.createOrUpdateTask("valid-token", {
      title: "Synced task",
    });
    assert.equal(upserted.id, "remote-1");
    assert.equal(calls[1]?.method, "POST");

    await assert.rejects(
      () => client.fetchTaskLists("bad-token"),
      /401/,
    );
  });
});
