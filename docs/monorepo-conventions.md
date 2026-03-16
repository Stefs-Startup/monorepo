# Monorepo Conventions

This document is the authoritative reference for naming, structure, and patterns
in this monorepo. Read this before creating new apps, packages, or files.

---

## Package Naming

All workspace packages use the `@cmp/` npm scope:

| Location | Example name | Example package.json `"name"` |
|----------|--------------|-------------------------------|
| `apps/web` | Web frontend | `@cmp/web` |
| `apps/api` | API server | `@cmp/api` |
| `apps/cli` | CLI tool | `@cmp/cli` |
| `packages/ui` | UI components | `@cmp/ui` |
| `packages/utils` | Utilities | `@cmp/utils` |
| `packages/types` | Shared types | `@cmp/types` |
| `packages/config` | Shared configs | `@cmp/config` |

**Rule:** Directory name matches the unscoped package name. `apps/web` → `@cmp/web`.

---

## Directory Structure Per Package

Every workspace package (app or library) should follow this layout:

```
<workspace>/
├── package.json        # Required. "name", "scripts", "dependencies"
├── tsconfig.json       # If TypeScript. Extends root or @cmp/config tsconfig.
├── README.md           # Package-specific docs: purpose, usage, local dev
└── src/
    └── index.ts        # Main entrypoint
```

**For libraries (packages/)**, also include:
```
├── tsconfig.build.json # Separate build config (excludes test files)
```

---

## Dependency Rules

These rules prevent circular dependencies and keep the graph clean:

```
apps/*      →  can depend on  →  packages/*
packages/*  →  can depend on  →  packages/*  (minimize depth)
apps/*      →  CANNOT depend on  →  apps/*
packages/*  →  CANNOT depend on  →  apps/*
```

When adding an inter-workspace dependency, use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@cmp/utils": "workspace:*"
  }
}
```

This tells pnpm to use the local version, never the registry version.

---

## TypeScript

- All new code should be TypeScript. No `// @ts-ignore` without a comment explaining why.
- Each package has its own `tsconfig.json` that extends a base config.
- Use `"strict": true`. Do not loosen strictness to avoid errors — fix the types.
- Project references (`composite: true`) should be used for packages that are
  imported by other packages. This enables incremental builds.

---

## Scripts Convention

Every `package.json` in the monorepo should expose these scripts when applicable:

| Script | Purpose |
|--------|---------|
| `dev` | Start local development server / watcher |
| `build` | Compile / bundle for production |
| `test` | Run unit and integration tests |
| `lint` | Run ESLint (and any other linters) |
| `typecheck` | Run `tsc --noEmit` |
| `clean` | Delete build artifacts (`dist/`, `.next/`, etc.) |

Scripts are run from the repo root via `pnpm --filter <name> <script>` or
across all packages via `pnpm -r <script>`.

---

## Environment Variables

- Never hardcode secrets or environment-specific values in source code.
- Each package that requires env vars should have a `.env.example` file
  listing all required variables with placeholder values and comments.
- Actual `.env` files are gitignored (see root `.gitignore`).
- Document the purpose of each env var in `.env.example`.

```bash
# .env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname   # Primary DB connection
API_SECRET=changeme                                          # Signing secret for JWTs
```

---

## Commit Messages

Follow Conventional Commits: https://www.conventionalcommits.org

```
<type>(<scope>): <description>

Types: feat, fix, chore, docs, refactor, test, ci, perf
Scope: the package name (web, api, ui) or repo-level concern (workspace, infra)

Examples:
  feat(web): add user authentication flow
  fix(api): handle null response from payment provider
  chore(workspace): upgrade pnpm to 9.1.0
  docs(adr): record decision to use pnpm workspaces
```

---

## Adding a New Workspace Package

1. Create the directory: `apps/<name>/` or `packages/<name>/`
2. Add `package.json` with `"name": "@cmp/<name>"` and `"private": true`
3. Add a `README.md` explaining what the package does
4. Run `pnpm install` from the repo root
5. If it's a library, add it as a dependency where needed using `workspace:*`
6. If the package introduces a new architectural pattern, write an ADR in `docs/adr/`

---

## Versioning

All packages are at `0.0.0` during early development. Versioning strategy
will be decided in a future ADR. Until then, use `workspace:*` for
all inter-package dependencies and do not publish packages externally.
