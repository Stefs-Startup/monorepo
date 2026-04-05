# ADR-0002: Monorepo over Polyrepo

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One (CMP-9)

---

## Context

Code for this Company of One will span multiple apps and shared libraries.
The fundamental structural question is: one repository or many?

---

## Decision

All code will live in a **single monorepo**.

---

## Rationale

### The core trade-off

Polyrepo optimizes for **team isolation** — different teams own different repos,
with separate CI, separate release cycles, and independent dependency versions.

Monorepo optimizes for **individual velocity** — one context, one CI pipeline,
atomic cross-package changes, and shared tooling with zero duplication.

For a Company of One, team isolation is not a goal. Individual velocity is everything.

### Specific advantages for this context

| Advantage | Why it matters |
|-----------|----------------|
| One `git clone` | No "which repo do I need?" decision per session |
| One IDE window | No switching projects to find a related file |
| Atomic cross-package changes | Fix a type in `@cmp/types` and update all consumers in one PR |
| Shared tooling config | ESLint, TypeScript, and test config defined once |
| Unified CI pipeline | One workflow file, not N per repo |
| Unified dependency upgrades | Upgrade a shared dep once, not N times across N repos |

### The cognitive tax argument

Context-switching between repositories has a measurable overhead per session:
- Navigating to the correct directory
- Checking out the right branch
- Running the right install command
- Opening the correct project in the IDE

This tax is small per occurrence but compounds across every working session.
With one person and limited hours, eliminating it entirely is the correct call.

### When polyrepo would be correct

- Multiple teams with strong ownership boundaries and independent release cadences
- Security requirements that mandate strict code isolation
- Repos at dramatically different scales (a tiny config repo vs a 10GB ML model repo)

None of these apply here.

---

## Consequences

**Becomes easier:**
- Cross-package refactors (rename a type used in 4 packages: one PR)
- Discovering related code (everything is in one place)
- Keeping deps in sync (one `pnpm-lock.yaml`)

**Becomes harder / constraints accepted:**
- Repo size grows over time (mitigated by `.gitignore` for build artifacts)
- All packages share the same Node/pnpm version constraints
- A broken root config (e.g. tsconfig) can affect all packages simultaneously

**Mitigations for the downsides:**
- The shared-version constraint is a feature for a solo maintainer — one upgrade, done
- Config errors are caught in CI before they affect production
