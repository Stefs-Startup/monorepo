# Pre-Execution Planning & Input Weak-Point Critic

> Run **before** spawning implementation workers or writing code in any codebase (small or enterprise).

## Mandatory Pre-Flight Rule

1. **Run `plan:critic` before execution**: Whenever starting from a spec, design doc, or multi-file plan, run the `packages/factory` `plan:critic` CLI (`node packages/factory/dist/src/cli.js plan:critic <spec-or-plan.md> --json`) before dispatching implementation workers or editing code.
2. **Audit all 4 weak-point categories**:
   - **Underspecified Inputs**: Flag missing target entrypoints, missing `REQ-*` / measurable acceptance criteria, unbounded adjectives (`fast`, `clean`, `secure` without thresholds), or undefined error/empty-state behavior.
   - **Missing Edge Cases**: Flag missing state-transition specs (auth/session persistence across process switches, dirty-state recovery, offline/timeout, concurrency/retry behavior).
   - **Unverified External Assumptions**: Cross-reference third-party SDKs, APIs, OS/toolchain flags, and auth flows against [`.agents/memory/gotchas/`](../gotchas/INDEX.md) and repo lockfiles/SDKs. Never assume an unverified external contract works.
   - **Conflicting Constraints**: Diff proposed paths, imports, and dependencies against root [`AGENTS.md`](../../../AGENTS.md), per-app `AGENTS.md`, `ci-projects.json` exclusions, and ADR boundary rules.

## Deterministic Escalation Matrix

Use the `escalationDecision` from `plan:critic` (or manual critic pass) to drive execution autonomously without interrupting humans for resolvable engineering work:

| Decision | Trigger Condition | Required Agent Action |
| :--- | :--- | :--- |
| **`AUTO_PROCEED`** | Detail is resolvable from repo conventions / `AGENTS.md`, or change is a reversible local refactor. | Proceed directly to implementation and verification. Do **not** ask the user. |
| **`AUTO_SPIKE`** | Unverified external assumption (SDK flag, API shape, OS/browser behavior, auth flow). | Run a minimal, time-boxed empirical spike first; record verified facts in [`.agents/memory/gotchas/`](../gotchas/INDEX.md); re-run critic. |
| **`ESCALATE_HUMAN`** | True decision boundary: conflicting product/business constraints, missing `REQ-*` acceptance criteria on user-facing behavior, frozen legacy boundary touch, or irreversible architectural/security trade-off. | **Stop before coding.** Present the exact ambiguity, options, and recommended default to the user. |

## Related References

- **Factory CLI**: [`packages/factory/README.md`](../../../packages/factory/README.md) (`plan:critic` command)
- **ADR**: [`ADR-MEM-004`](../decisions/ADR-MEM-004-sota-qe-and-planning-critic.md)
- **Agent Workflow**: [`agent-workflow.md`](./agent-workflow.md)
