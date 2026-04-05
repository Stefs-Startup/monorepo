# ADR-0000: Architecture Decision Record Process

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One

---

## Context

As this monorepo grows, architectural decisions will be made — some obvious,
some contentious, some only clear in retrospect. Without a record of *why*
decisions were made, future maintainers (human or agent) will:

- Relitigate settled questions
- Reverse decisions without understanding the trade-offs
- Make inconsistent choices because the original rationale is invisible

A lightweight decision record process solves this at near-zero overhead.

---

## Decision

We will use **Architecture Decision Records (ADRs)** stored in `docs/adr/`.

Each ADR is a short Markdown file with a fixed structure (see template below).
ADRs are **append-only** — once accepted, an ADR is never edited. If a decision
is reversed or superseded, a new ADR is written that references the old one.

### File Naming

```
docs/adr/<NNNN>-<short-kebab-case-title>.md
```

- `NNNN` is a zero-padded sequential number starting at `0000`
- Numbers are never reused, even if an ADR is abandoned
- Title should be descriptive enough to scan in a directory listing

### Status Values

| Status | Meaning |
|--------|---------|
| `Proposed` | Under discussion, not yet decided |
| `Accepted` | Decision made, being implemented |
| `Superseded by ADR-NNNN` | This decision was reversed; see the referenced ADR |
| `Deprecated` | No longer relevant but kept for history |

### Template

```markdown
# ADR-NNNN: Title

**Status:** Proposed / Accepted / Superseded by ADR-XXXX
**Date:** YYYY-MM-DD
**Deciders:** [who made this decision]

---

## Context

[Describe the situation, the problem, and the forces at play.
What made this decision necessary? What constraints existed?]

## Decision

[State the decision clearly. "We will use X." Not "We should consider X."]

## Rationale

[Why was this option chosen over alternatives?
List alternatives considered and why they were rejected.]

## Consequences

[What are the trade-offs? What becomes easier? What becomes harder?
What future decisions does this constrain?]
```

---

## Rationale

- **Lightweight**: Each ADR is a single Markdown file. No tools, no databases, no process overhead.
- **Durable**: Stored in git alongside the code it describes. History is preserved forever.
- **Agent-readable**: Structured format makes it straightforward for AI agents to locate and parse rationale before making changes.
- **Append-only**: Preserves the full reasoning history. Future readers can see how thinking evolved.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Wiki / Confluence | Lives outside the repo. Decoupled from code history. Requires separate access. |
| Comments in code | Scattered, not searchable as a corpus, no standard format. |
| No records | Acceptable short-term, expensive long-term. The cost of writing is low; the cost of lost context is high. |

---

## Consequences

- Any significant architectural decision should produce an ADR before or alongside the implementation.
- "Significant" means: technology choice, structural pattern, data model, security approach, API contract.
- Trivial decisions (naming a variable, choosing a utility function) do not need ADRs.
- Agents working in this repo should check `docs/adr/` before making structural changes.
