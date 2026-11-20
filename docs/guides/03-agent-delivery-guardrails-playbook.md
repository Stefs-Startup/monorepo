# Agent-Native Delivery Guardrails & Scheduled-Agent Audit Playbook (`STE-52` + `STE-51`)

> **Purpose:** Operator and agent reference for the monorepo PR dispatch/dedupe guardrails, daily stale coding-agent sweeper, scheduled-agent audit findings, and Linear `agent-ready` workflow (**Epic 1 — `STE-31`**).

---

## 1. Architecture Overview (Functional Core, Imperative Shell)

Following [`ADR-007`](../stack-best-practices/README.md), PR guardrail decisions are split cleanly into a zero-dependency pure TypeScript policy core inside `@cmp/factory` and thin execution adapters:

```
packages/factory/src/pr-guard-policy.ts   --> Pure rules (classify, dedupe, branch check, cap=5, stale>=7d)
packages/factory/src/pr-guard-cli.ts      --> Local/CI JSON CLI (--mode=pr|stale)
packages/factory/src/pr-guard-github.ts   --> GitHub REST adapter (dryRun + sticky comment/close client)
.github/workflows/agent-pr-guard.yml      --> Automated PR + daily cron enforcement
```

---

## 2. Guard Policy Rules (`STE-52`)

| Actor Category | Detection Signals | 1-PR-per-Issue Dedupe | Linear Branch Required | Max Concurrent Cap (`5`) | Stale Auto-Close (`>= 7d`) | On Violation |
|---|---|---|---|---|---|---|
| **`dependency-bot`** | `dependabot[bot]`, `app/dependabot`, `renovate[bot]`, `app/renovate` | Exempt (governed by [`.github/dependabot.yml`](../../.github/dependabot.yml) & [`renovate/config.js`](../../renovate/config.js)) | No | Excluded from cap | Excluded | Allowed |
| **`coding-agent`** | Non-dependency `*[bot]` / `authorIsBot`, labels (`agent`, `agent-pr`, `automated-agent`), or agent `Co-authored-by` / body attribution | **Enforced** (lowest PR `#` is canonical) | **Enforced** (`STE-XX` / `CMP-XX` Linear branch) | **Enforced** (oldest 5 open slots kept) | **Enforced** (daily `09:00 UTC` sweep) | Fail check + sticky comment (`<!-- cmp-agent-pr-guard -->`) + **auto-close** |
| **`human`** | Standard user-authored PRs without agent signals | **Enforced** (lowest PR `#` is canonical) | Optional | Excluded from cap | Excluded | Fail check + sticky comment (**never auto-closed**) |
| **`guard-exempt` label** | Any PR carrying the `guard-exempt` label | Bypassed | Bypassed | Excluded from cap slots | Skipped | Allowed (escape hatch) |

---

## 3. Scheduled-Agent Audit (`2026-11-20`)

### A. In-Repository GitHub Workflows (`.github/workflows/`)

An audit of every `schedule:` and bot-triggered workflow in `.github/workflows/` confirmed that **zero in-repo GitHub Actions schedules open duplicate feature/scaffold/roadmap PRs**:

| Workflow / Config | Trigger | Purpose & Safety Posture |
|---|---|---|
| [`.github/workflows/security.yml`](../../.github/workflows/security.yml) | Weekly `0 6 * * 1` + PR/push | Secret scanning & dependency/static security checks (no PR creation) |
| [`.github/workflows/mutation.yml`](../../.github/workflows/mutation.yml) | Weekly `0 4 * * 0` + `workflow_dispatch` | Stryker + PITest mutation testing (no PR creation) |
| [`.github/workflows/renovate-self-hosted.yml`](../../.github/workflows/renovate-self-hosted.yml) | Weekly `0 14 * * 1` + PR/dispatch | Self-hosted Renovate OSS defaulting to `dryRun: "full"` |
| [`.github/workflows/claude.yml`](../../.github/workflows/claude.yml) | Explicit `@claude` mention in issues/PR comments | On-demand assistant only (never scheduled) |
| [`.github/workflows/claude-code-review.yml`](../../.github/workflows/claude-code-review.yml) | `pull_request` (skips `[bot]` actors) | Automated PR code review only |
| [`.github/dependabot.yml`](../../.github/dependabot.yml) | Weekly Monday `09:00 America/New_York` | Grouped dependency bumps with explicit `open-pull-requests-limit` per ecosystem |

### B. Historical Duplicate PRs & Retired External Schedules

Historical duplicate PRs (`#37`–`#49`) originated from retired external scheduled runs that are no longer used going forward. All active automated PR dispatch in this repository now routes through Linear `agent-ready` issues and is enforced by [`.github/workflows/agent-pr-guard.yml`](../../.github/workflows/agent-pr-guard.yml).

---

## 4. Dry-Run & Verification Commands

### Local Dry-Run Against Live Open GitHub PRs

```bash
# Export currently open PRs into a temporary snapshot matching PullRequestSnapshot
gh pr list --state open --limit 100 --json number,title,body,headRefName,author,labels,createdAt,updatedAt,isDraft \
  | node -e '
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(0, "utf8"));
    const openPrs = raw.map((p) => ({
      number: p.number,
      title: p.title,
      body: p.body || "",
      headRef: p.headRefName,
      authorLogin: p.author?.login || "unknown",
      authorIsBot: Boolean(p.author?.is_bot),
      labels: (p.labels || []).map((l) => l.name),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      draft: Boolean(p.isDraft),
    }));
    console.log(JSON.stringify({ openPrs }, null, 2));
  ' > /tmp/open-prs.json

# Evaluate stale sweep safely (read-only)
node packages/factory/dist/src/pr-guard-cli.js --mode=stale --input=/tmp/open-prs.json

# Evaluate a specific PR number without failing exit code
node packages/factory/dist/src/pr-guard-cli.js --mode=pr --input=/tmp/open-prs.json --pr=114
rm -f /tmp/open-prs.json
```

### GitHub Actions Manual Dry-Run

Once [`.github/workflows/agent-pr-guard.yml`](../../.github/workflows/agent-pr-guard.yml) is on `main`:

```bash
gh workflow run agent-pr-guard.yml -f mode=stale -f dry_run=true
```

---

## 5. Human-Handoff Checklist

These setup items cannot be automated via repository files or current MCP APIs:

1. **Save the Linear Issue Template in Linear UI Settings (`STE-51`):**
   - Open Linear → **Workspace / Team Settings (`StefsWork` / `STE`) → Templates → New Issue Template**.
   - Paste the body of [`docs/templates/linear-agent-ready-issue.md`](../templates/linear-agent-ready-issue.md) and attach the `agent-ready` label guideline.
2. **Link Playbook in `docs/README.md`:**
   - When committing existing `docs/README.md` changes, add a row linking `guides/03-agent-delivery-guardrails-playbook.md` beneath guides `01` and `02`.
