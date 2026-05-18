# 🔬 Experiment Proposal & Log: EXP-002

> **Status:** `ACTIVE`  
> **Owner:** @sheldoncrosss  
> **Start Date:** 2026-05-18  
> **Target End Date:** 2026-06-01  

---

## 📋 1. Executive Summary & Problem Statement

### The Problem
Building a successful product requires a deep, continuous understanding of our competitive landscape. However, traditional market audits suffer from structural decay: they are usually written as isolated PDFs or static Google Docs that engineers never read, leading to a commercial strategy that is completely disconnected from everyday technical architecture. Furthermore, we are building a developer-centric product but have not yet fully dogfooded our Developer Portal (`apps/backstage`) to coordinate business-critical information.

### The Proposed Solution
We will perform our **Market Audit (STE-15)** as an active **Dogfooding Experiment**. Instead of writing a dry paper, we will model our top 5 direct competitors and their public developer offerings as actual **Software Components and APIs** directly inside our Backstage Developer Portal. 

Each competitor will get a standard `catalog-info.yaml` entity definition registering their capability systems. Their developer documentation, API designs, and pricing sheets will be indexed and compiled via TechDocs, making them fully searchable and queryable in our everyday developer cockpit.

---

## 🧪 2. Hypothesis & Scoring

### Hypothesis Statement
Applying the strict protocol structure:

> **We believe that** dogfooding our Backstage Developer Portal to catalog and index competitive market intelligence (including public APIs and developer ecosystems)  
> **for** our engineering and strategy teams  
> **will result in** a unified, search-discoverable product strategy knowledge base directly integrated with our codebase,  
> **and we will know this is successful when we observe** a 100% catalog registration rate of our top 5 competitors and their core APIs rendered in Backstage TechDocs with 0 schema validation errors.

### Value vs. Effort Scoring (RICE)

Evaluate using the metrics defined in the [Experiment Protocol](../protocol.md):

| Metric | Score | Rationale & Definition |
| :--- | :--- | :--- |
| **Reach** | *100%* | *100% of our current and future engineering and product leads will use this.* |
| **Impact** | *2.0 (High)* | *Directly aligns technical execution with business intelligence and dogfoods our core platform.* |
| **Confidence** | *95%* | *We have a functioning Backstage setup and clear schema models.* |
| **Effort** | *3 dev-days* | *Writing competitor catalog definitions and compiling competitive analysis into TechDocs.* |

$$\text{RICE Score} = \frac{100 \times 2.0 \times 0.95}{3} = 63.33$$

> **Calculated RICE Score:** `63.33`

### 🎯 Niche & Stack Alignment

*Explain how this experiment connects to highly specialized domain knowledge and a career-focused tech stack:*
- **Niche Domain Knowledge:** Competitive product auditing, developer portal orchestration, software component architecture modeling, and Backstage entity schema taxonomy.
- **Career-Focused Stack:** Spotify's Backstage Developer Portal, MkDocs/TechDocs, TypeScript, Yarn 4, and Turborepo monorepo conventions.
- **Dogfooding Component:** We are using our own local Backstage portal to map out the external market, proving the tool's organizational utility before selling or deploying developer portal solutions externally.

---

## 📈 3. Success Gates

### 🟢 The Green Gate (Primary Success Metric)
*The precise quantitative threshold that, if met or exceeded, validates the hypothesis.*
*   **Metric:** 100% of the top 5 competitors successfully cataloged as Backstage `Component` / `API` entities and their feature audits indexed under TechDocs.
*   **Baseline:** 0 competitors cataloged.
*   **Target:** 5/5 competitors fully registered, running, and accessible under the search indexing service.
*   **Measurement Source:** Backstage Catalog API and MkDocs site build verification.

### 🔴 The Red Gate (Guardrail Metrics)
*Critical operational or quality thresholds that must NOT degrade.*
*   **System Performance:** TechDocs compilation time must not increase by > 20%.
*   **Schema Validity:** Zero validation errors on the catalog files (strictly compliant with Backstage Catalog Schema `backstage.io/v1alpha1`).
*   **Code Integrity:** Zero linting, typechecking, or workspace validation breaks in `/Users/stefan/Code/monorepo`.

---

## 💻 4. Technical Scaffolding & Scope

### Isolated Directory Scaffolding
Following our scaffolding conventions, the competitor catalog files and market analysis documentation will live in:
*   **Experiment Package Name:** `@cmp/exp-market-audit`
*   **Directory Path:** `docs/experiments/active/exp-002-market-audit/`

Inside this folder, we will structure:
```
docs/experiments/active/exp-002-market-audit/
├── catalog/
│   ├── competitor-1.yaml   # Backstage Component definition for Competitor 1
│   ├── competitor-2.yaml   # Backstage Component definition for Competitor 2
│   ├── competitor-3.yaml   # ...
│   ├── competitor-4.yaml
│   └── competitor-5.yaml
└── documentation/
    ├── overview.md         # Market landscape overview
    ├── core-capabilities.md # Feature-by-feature comparison matrices
    └── pricing-analysis.md # Competitive pricing audits
```

---

## 🧪 5. Testing & Visual Validation Checklist

- [ ] **Catalog Schema Validation**: Run entity validation checking that the catalog files strictly conform to the Backstage schema.
- [ ] **Visual Registry Audit**: Verify that competitor entities render correctly with high-fidelity branding metadata in the catalog UI.
- [ ] **Search Verification**: Test that typing a competitor's API name in Backstage Global Search retrieves the indexed documentation.
- [ ] **TechDocs Registration**: Add this active proposal to the experiments section in `mkdocs.yml`.

---

## ⚖️ 6. Post-Experiment Evaluation

*To be filled out at the end of the experiment timeline.*
