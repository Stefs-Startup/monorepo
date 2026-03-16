# ADR-0001: Use pnpm Workspaces as the Monorepo Tool

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One (CMP-9)

---

## Context

CMP-9 requires establishing the monorepo structure. A monorepo tool must be
chosen to manage multiple workspace packages, their dependencies, and
cross-package scripts. The primary constraints:

- Single maintainer — tooling complexity has direct cognitive cost
- Bootstrap phase — over-engineering early locks in complexity before patterns emerge
- AlmaLinux VM + Mac development — tooling must work identically on both
- CI will need to run installs and builds reproducibly

The candidate tools were: npm workspaces, Yarn workspaces, pnpm workspaces, Nx, Turborepo.

---

## Decision

We will use **pnpm workspaces** as the monorepo management tool.

Configuration lives in `pnpm-workspace.yaml` at the repo root.
The Node version is pinned to 20 LTS via `.nvmrc` and `.node-version`.
pnpm version is constrained to `>=9` in the root `package.json` engines field.

---

## Rationale

### Why pnpm over npm/Yarn

| Concern | pnpm advantage |
|---------|----------------|
| Disk space | Hard-linked `node_modules` — packages stored once, linked everywhere |
| Install speed | Consistently faster than npm, comparable to Yarn PnP |
| Correctness | Strict by default — no phantom dependencies (packages not in your `package.json` are not accessible) |
| Workspace support | First-class, minimal config |
| Lock file | `pnpm-lock.yaml` is deterministic and human-readable |

The phantom dependency protection is particularly valuable: it prevents a class
of bugs where code works locally (because a dep is hoisted) but breaks in CI or
production (where hoisting differs). pnpm makes these failures immediate and local.

### Why pnpm Workspaces over Nx

Nx adds:
- Task graph with caching (`nx affected`, `nx run-many`)
- Project configuration files per workspace
- Generators and executors
- A daemon process

These are valuable at scale (3+ apps, large teams, slow CI). At bootstrap phase
with one maintainer and zero apps, each Nx feature is overhead before it pays off.

**Decision rule:** Start with pnpm workspaces. If CI becomes slow due to running
unnecessary tasks, or if dependency analysis becomes complex, migrate to Nx or
add Turborepo on top of pnpm. This migration path is well-documented and non-destructive.

### Why pnpm Workspaces over Turborepo

Turborepo is a task runner that sits on top of a package manager's workspace
support. It could be added later without structural changes. Adding it now,
before there are multiple apps with slow build pipelines, provides no benefit
and adds a config surface to maintain.

---

## Consequences

**Becomes easier:**
- Installing all deps: `pnpm install` from repo root
- Running a command in one package: `pnpm --filter <name> <cmd>`
- Running a command everywhere: `pnpm -r <cmd>`
- Adding inter-package deps: `"@cmp/utils": "workspace:*"` in package.json

**Becomes harder / constraints accepted:**
- Contributors must have pnpm installed (not just npm). Mitigated by `corepack enable`.
- pnpm's strict module resolution can occasionally require explicitly declaring
  transitive dependencies. This is the correct behavior — fix the dep, not the tool.

**Future decisions constrained:**
- If Nx is adopted later, `pnpm-workspace.yaml` remains as the package manager
  layer; Nx wraps on top. No structural migration needed.
- Publishing to npm registry requires `"private": false` per-package and a
  release tool (changesets, semantic-release). This is out of scope for now.
