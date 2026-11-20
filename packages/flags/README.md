# `@cmp/flags`

Feature flags and experimentation engine (`STE-57`): local defaults, emergency kill switches, deterministic per-user percentage rollouts, weighted A/B experiment assignment, and zero-PII exposure/outcome hooks wired through `@cmp/observability`.

## Usage

```ts
import { createObservabilityClient } from "@cmp/observability";
import { createFlagsClient } from "@cmp/flags";

const obs = createObservabilityClient({ service: "pulse-web" });
const flags = createFlagsClient({
  observability: obs,
  flags: [
    {
      key: "pulse.ai-reflection-stream",
      description: "Enable live AI partner reflection streaming",
      defaultEnabled: false,
      rolloutPercentage: 50,
    },
  ],
});

const evalResult = flags.evaluateFlag("pulse.ai-reflection-stream", {
  userId: "user@example.com",
});
```

## Development

```bash
pnpm --filter @cmp/flags lint
pnpm --filter @cmp/flags typecheck
pnpm --filter @cmp/flags build
pnpm --filter @cmp/flags test
```
