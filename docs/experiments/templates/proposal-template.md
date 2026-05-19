# 🔬 Experiment Proposal & Log: EXP-XXX

> **Status:** `PROPOSED` (Options: `PROPOSED` | `ACTIVE` | `PERSEVERE` | `PIVOT`)  
> **Owner:** @username  
> **Start Date:** YYYY-MM-DD  
> **Target End Date:** YYYY-MM-DD  

---

## 📋 1. Executive Summary & Problem Statement

### The Problem
*Describe the user pain point, system inefficiency, or strategic opportunity this experiment aims to address. What is the evidence that this problem exists?*

### The Proposed Solution
*Describe the proposed feature, optimization, or architecture. Keep it focused on the bare minimum required to test the hypothesis.*

---

## 🧪 2. Hypothesis & Scoring

### Hypothesis Statement
Applying the strict protocol structure:

> **We believe that** [doing action / implementing feature]  
> **for** [target audience / system component]  
> **will result in** [expected outcome / impact],  
> **and we will know this is successful when we observe** [measurable quantitative metric / signal].

### Value vs. Effort Scoring (RICE)

Evaluate using the metrics defined in the [Experiment Protocol](../protocol.md):

| Metric | Score | Rationale & Definition |
| :--- | :--- | :--- |
| **Reach** | *0-100% / # Users* | *How many users or processes will interact with this weekly?* |
| **Impact** | *0.25 - 3.0* | *0.25 = minimal, 0.5 = low, 1.0 = medium, 2.0 = high, 3.0 = massive solution to the pain.* |
| **Confidence** | *0 - 100%* | *How certain are we about our reach, impact, and effort estimates?* |
| **Effort** | *Dev-days* | *Estimated person-days to scaffold, test, and run the experiment.* |

$$\text{RICE Score} = \frac{\text{Reach} \times \text{Impact} \times \text{Confidence}}{\text{Effort}}$$

> **Calculated RICE Score:** *[Insert Score]*

### 🎯 Niche & Stack Alignment

*Explain how this experiment connects to highly specialized domain knowledge and a career-focused tech stack:*
- **Niche Domain Knowledge:** *[Identify the specialized industry segment or technical domain being tested, e.g., Developer Portals, WCAG Accessibility, Stablecoin Flows, AEO, outbound sales metrics]*
- **Career-Focused Stack:** *[Identify the modern, premium technology stack being utilized, e.g., Backstage, Turborepo, Playwright, React Signals, NestJS]*
- **Dogfooding Component:** *[Explain how we are dogfooding this capability directly within our own system or workflow]*

---

## 📈 3. Success Gates

To maintain scientific integrity and prevent scope creep, we define binary gates:

### 🟢 The Green Gate (Primary Success Metric)
*The precise quantitative threshold that, if met or exceeded, validates the hypothesis and justifies permanent integration.*
*   **Metric:** [e.g., Backstage Developer Catalog registration rate]
*   **Baseline:** [e.g., 0%]
*   **Target:** [e.g., > 10% within 14 days]
*   **Measurement Source:** [e.g., PostgreSQL query / Google Analytics]

### 🔴 The Red Gate (Guardrail Metrics)
*Critical operational or quality thresholds that must NOT degrade. If any Red Gate is breached, the experiment must be paused or immediately aborted.*
*   **System Performance:** [e.g., P95 latency must remain < 200ms]
*   **Accessibility:** [e.g., WCAG / Lighthouse Accessibility score must not drop below 95/100]
*   **Code Integrity:** [e.g., No new circular dependencies introduced, code coverage remains above 80%]
*   **Reliability:** [e.g., System crash or API error rate must remain below 0.05%]

---

## 💻 4. Technical Scaffolding & Scope

### isolated Directory Scaffolding
Following [monorepo-conventions.md](../../monorepo-conventions.md), the experiment must live in an isolated space.
*   **Experiment Package Name:** `@cmp/exp-[name]`
*   **Directory Path:** `apps/exp-[name]/` or `packages/exp-[name]/`
*   *Note: If updating an existing app, list the feature flags or config overrides guarding the logic:*
    - `FEATURE_FLAG_EXP_XXX=true`

### Minimal Viable Implementation Details
*List the core files and changes required. Avoid any pre-optimization or scaling infrastructure.*

---

## 🧪 5. Testing & Visual Validation Checklist

An experiment is not ready for execution until it can be verified.

- [ ] **Unit / Integration Tests**: Implemented locally within the experiment package.
  - Run command: `pnpm --filter @cmp/exp-[name] test`
- [ ] **Visual Regression Capture**: UI layout captured using Playwright across mobile and desktop Viewports.
  - Run command: `./qa-playwright-capture.sh http://localhost:[port] public/qa-screenshots`
- [ ] **Lighthouse / Accessibility Audit**: Verify that the Lighthouse Accessibility score is above 95.
- [ ] **TechDocs Registration**: Added this proposal to `mkdocs.yml` under `Experiments -> Active`.

---

## ⚖️ 6. Post-Experiment Evaluation

*To be filled out at the end of the experiment timeline.*

### Observed Metrics
*Compare the actual outcomes against the pre-defined gates.*

| Metric | Target | Actual | Gate Status |
| :--- | :--- | :--- | :--- |
| **Primary (Green)** | *Target* | *Actual* | `PASSED` / `FAILED` |
| **Guardrail (Red 1)** | *Threshold* | *Actual* | `PASSED` / `FAILED` |
| **Guardrail (Red 2)** | *Threshold* | *Actual* | `PASSED` / `FAILED` |

### Key Learnings & Data Insights
*What did we learn? Did any unexpected user behaviors or side-effects occur?*

### The Decision
*Check one:*

*   [ ] **Option A: Persevere (Integrate & Scale)**
    *Refactor code out of the experimental scaffold into standard packages. Remove feature flags. Archive this log.*
*   [ ] **Option B: Pivot (Cleanly Purge)**
    *Delete experimental directories. Keep only this markdown log in `docs/experiments/archive/` as institutional knowledge.*
