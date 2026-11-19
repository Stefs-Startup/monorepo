# RFC-0001: Crossplane as a Kubernetes Infrastructure Control Plane

- **Status:** `Parked`
- **Date:** 2026-11-19
- **Author:** Stefan + Antigravity
- **Goal:** Learning reference + clear revisit criteria before introducing cloud control-plane infrastructure.

---

## 1. What Crossplane Is (Mental Model)

[Crossplane](https://www.crossplane.io/) is an open-source CNCF project that turns a Kubernetes cluster into a **universal infrastructure control plane**.

Instead of running a CLI like `terraform apply` from CI to create cloud resources (databases, buckets, IAM roles, DNS, Pub/Sub), Crossplane runs Kubernetes controllers that **continuously reconcile** desired cloud state declared in Kubernetes YAML.

### Core Primitives to Know

| Primitive | Role | Analogy |
|---|---|---|
| **Provider** | Bridges Kubernetes CRDs to a cloud API (`provider-gcp`, `provider-aws`, `provider-github`, `provider-sql`) | Terraform provider, but running as a long-lived controller pod |
| **Managed Resource (MR)** | Low-level 1:1 cloud resource in YAML (e.g., `CloudSQLInstance`, `Bucket`, `ServiceAccount`) | Raw `resource "google_sql_database_instance"` in Terraform |
| **Composite Resource Definition (`XRD`)** | Custom schema defined by the platform team (e.g., `AppPostgres` with just `size: small \| medium`, `region`) | Typed API / module interface |
| **Composition** | Maps an `XRD` into the underlying Managed Resources + wiring + security defaults | Terraform module implementation |
| **Claim (`XRC`)** | Namespace-scoped request an app team submits against an `XRD` | Self-service ticket fulfilled automatically in ~minutes |

---

## 2. Problems Crossplane Actually Solves

1. **Self-Service Internal Developer Platforms (IDPs)**
   - Platform teams encode security, networking, encryption, and tagging guardrails inside `Composition`s.
   - App teams request a database or environment with ~15 lines of YAML (or via a Backstage form) without needing raw cloud IAM permissions or Terraform expertise.
2. **Continuous Drift Detection & Self-Healing**
   - Terraform only notices drift when CI runs `plan`/`apply`.
   - Crossplane reconciles on a continuous loop, reverting unauthorized manual console edits automatically.
3. **Unified GitOps (Argo CD / Flux)**
   - App Deployments and their cloud dependencies (DB, Redis, queue, IAM) live in the same Git repo and deploy through the exact same GitOps sync and PR workflow.
4. **Environment Parity / Abstraction**
   - One internal API (`Cache`, `Database`) can be backed by Cloud SQL / RDS in `prod` and a lightweight in-cluster container in `dev` or ephemeral PR previews.
5. **Ephemeral PR Preview Environments**
   - Creating a Kubernetes namespace/claim spins up isolated cloud resources for a PR; deleting the namespace garbage-collects them automatically.

---

## 3. Alternatives (Start Simpler First)

| Stage | Recommended Tooling | Why |
|---|---|---|
| **Pre-deployables (now)** | Local Docker Compose / native dev + CI | Zero cloud control-plane overhead |
| **First 1–3 deployables** | Managed PaaS (Cloud Run, Fly.io, Railway, Vercel) or a small OpenTofu/Terraform root | Minutes to set up; no management cluster to operate |
| **Growing multi-service platform** | OpenTofu / Terraform + reusable modules | Mature ecosystem, ephemeral CI execution, no idle controller pods |
| **Multi-team Kubernetes IDP** | **Crossplane** (+ Argo CD / Flux / Backstage) | Pays off when you need self-service K8s APIs + always-on reconciliation |

---

## 4. Why This Is Parked Right Now

Adding Crossplane before having real production deployables is **premature operational weight**:

- Requires running and securing an always-on **Kubernetes management cluster**.
- Crossplane provider pods consume noticeable **RAM/CPU** even when idle.
- Adds **CRD schema management, composition debugging, and provider upgrade toil** with no active bottleneck to justify it yet.

---

## 5. Triggers to Revisit (When to Promote to an ADR)

Re-open this RFC when **at least two** of the following become true:

- [ ] We have **3+ real deployable services** running in Kubernetes across `dev` / `staging` / `prod`.
- [ ] We are **copy-pasting** the same Terraform/IAM/DB/bucket wiring across services or teams.
- [ ] We want **ephemeral PR preview environments** that automatically provision and tear down real cloud dependencies.
- [ ] Developers need **self-service infra requests** (e.g., from Backstage or GitOps PRs) without raw cloud console access.

---

## 6. Learning Exercises (Zero-Commit Exploration)

If you want to understand Crossplane hands-on without polluting this repo:
1. Spin up a disposable local `kind` cluster (`kind create cluster`) and install Crossplane via Helm.
2. Write a minimal `XRD` + `Composition` backed by `provider-nop` (no real cloud account needed) to see how Claims bind to Composite Resources.
3. Compare the developer experience of editing a 15-line Claim YAML vs. a Terraform module call.
