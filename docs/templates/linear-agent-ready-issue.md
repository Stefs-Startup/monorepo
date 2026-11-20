# Agent-Ready Linear Issue Template (`STE-51`)

> Paste the Markdown template below into **Linear → Team Settings (`StefsWork` / `STE`) → Templates → New Issue Template**.  
> Only apply the **`agent-ready`** label after all 4 sections are populated and pass local validation (`node packages/factory/dist/src/agent-ready-spec-cli.js <file.md>`).

---

```markdown
## Context

<!-- List the exact file paths, workspace packages, workflows, or architectural areas involved. -->

## Constraints

<!-- Hard guardrails: stack conventions, boundary rules, CI/hook parity, or things that must not break. -->

## Acceptance criteria

<!-- Every item must be checkable by an automated test, CLI command, or observable exit status. -->
- [ ] `<command or test>` passes with `<expected outcome>`

## Out of scope

<!-- Explicit non-goals so coding agents do not bundle unrelated refactoring or features. -->
```
