# Company of One — Monorepo

> One person. One repo. All the things.

This is the root of the **CMP monorepo** — the single source of truth for all
apps, shared packages, infrastructure, and documentation in this Company of One.

---

## Repository Map

```
/
├── apps/          Deployable units — web apps, APIs, CLIs
├── packages/      Shared libraries consumed across apps
├── infra/         Infrastructure as code — Docker, Compose, IaC (CMP-12)
└── docs/          Human + agent documentation
    └── adr/       Architecture Decision Records (CMP-13)
```

---

## Getting Started

**Prerequisites:** Node 20 LTS · pnpm 9+

```bash
# Install the correct Node version (if using nvm or fnm)
nvm use        # reads .nvmrc → Node 20

# Install pnpm if you don't have it
corepack enable

# Install all workspace dependencies from the repo root
pnpm install

# Run all dev servers in parallel
pnpm dev

# Run all tests
pnpm test

# Run all linters
pnpm lint

# Type-check everything
pnpm typecheck
```

---

## Workspace Commands

pnpm workspaces let you run commands scoped to one package or all packages:

```bash
# Run a command in a specific workspace
pnpm --filter <package-name> <command>

# Example: run dev only for the web app
pnpm --filter web dev

# Run a command recursively across ALL workspaces
pnpm -r build

# Add a dependency to a specific workspace
pnpm --filter web add react

# Add a shared package as a workspace dependency
pnpm --filter web add @cmp/ui --workspace
```

---

## Adding a New App or Package

1. Create a directory under `apps/` or `packages/`
2. Add a `package.json` with a `"name"` field prefixed with `@cmp/`
   - Apps: `"name": "@cmp/web"`, `"name": "@cmp/api"`
   - Packages: `"name": "@cmp/ui"`, `"name": "@cmp/utils"`
3. Run `pnpm install` from the repo root
4. See `docs/monorepo-conventions.md` for naming and structure conventions

---

## Documentation

- [`docs/`](./docs/) — Architecture docs, conventions, runbooks
- [`docs/adr/`](./docs/adr/) — Architecture Decision Records
- [`docs/monorepo-conventions.md`](./docs/monorepo-conventions.md) — Naming, structure, patterns

