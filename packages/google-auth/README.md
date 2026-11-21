# `@cmp/google-auth`

Reusable Google OAuth session utilities, Zero-PII sign-in diagnostics classifier, Google Tasks REST API client (`HttpGoogleTasksClient`), and deterministic in-memory fake providers (`FakeGoogleOAuthProvider`, `FakeGoogleTasksProvider`) requiring zero real Google credentials.

## Usage

```ts
import {
  FakeGoogleOAuthProvider,
  FakeGoogleTasksProvider,
  classifyGoogleSignInFailure,
  isAuthorizedSession,
  maskToken,
} from "@cmp/google-auth";

const oauth = new FakeGoogleOAuthProvider();
const session = oauth.signIn("alex.rivera@example.com");

if (isAuthorizedSession(session.email, session.accessToken)) {
  const tasksProvider = new FakeGoogleTasksProvider();
  const lists = await tasksProvider.fetchTaskLists(session.accessToken);
  console.log("Safe token:", maskToken(session.accessToken), "lists:", lists.length);
}
```

## Development

```bash
pnpm --filter @cmp/google-auth lint
pnpm --filter @cmp/google-auth typecheck
pnpm --filter @cmp/google-auth build
pnpm --filter @cmp/google-auth test
```
