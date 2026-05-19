# 🔬 Experiment Proposal & Log: EXP-003

> **Status:** `ACTIVE`  
> **Owner:** @sheldoncrosss  
> **Start Date:** 2026-05-18  
> **Target End Date:** 2026-06-01  

---

## 📋 1. Executive Summary & Problem Statement

### The Problem
Building a developer-centric startup requires an exceptionally sharp understanding of our buyers and users. However, typical "target persona" sheets are corporate slides and passive PDFs that sit in shared drives, completely divorced from the daily workflow of product engineers. This gap leads to a structural drift where developers build features without empathy for the user's specific operational environment, cognitive load, and budgeting sensitivities. 

Furthermore, our completed competitive audit (`EXP-002`) showed that incumbents (Port, Cortex, OpsLevel) charge aggressive seat-based fees and are designed for massive enterprise platform teams. To compete, our product must target the precise developer pain points they neglect: microservices cognitive overload, complex developer portal maintenance, and seat-based licensing dread.

### The Proposed Solution
We will model our **Target Persona & Ideal Customer Profile (ICP) Analysis (STE-16)** as an active **Dogfooding Experiment**. 

Instead of static slides, we will model our target user and buyer personas as active **User and Group Catalog Entities** directly inside our Spotify Backstage Developer Portal. 
Each persona will get a standard `backstage.io/v1alpha1` entity configuration under the Organization model, showing their role, team relation, and specific technical constraints. Their detailed goals, friction points, seat sensitivities, and stack alignments will be authored as high-fidelity markdown documentation and indexed under TechDocs, making target user empathy an active search capability in our daily development environment.

---

## 🧪 2. Hypothesis & Scoring

### Hypothesis Statement
Applying the strict protocol structure:

> **We believe that** dogfooding our Backstage Developer Portal to catalog and index our Target Developer Personas and ICP profiles as active Catalog Entities and searchable TechDocs  
> **for** our engineering, product, and strategy teams  
> **will result in** a unified, search-discoverable product strategy cockpit that forces daily technical decisions to align directly with user pain points and strategic differentiators,  
> **and we will know this is successful when we observe** a 100% catalog registration rate of our primary user and buyer personas rendered in Backstage TechDocs with 0 schema validation errors.

### Value vs. Effort Scoring (RICE)

Evaluate using the metrics defined in the [Experiment Protocol](../protocol.md):

| Metric | Score | Rationale & Definition |
| :--- | :--- | :--- |
| **Reach** | *100%* | *100% of our current and future development and marketing activities will reference these personas.* |
| **Impact** | *2.0 (High)* | *Fuses product empathy directly with our code catalog and clarifies our competitive positioning.* |
| **Confidence** | *90%* | *High certainty derived directly from our market audit data of seat-based vs. flat-rate gaps.* |
| **Effort** | *2 dev-days* | *Writing persona catalog files, designing the ICP sheet, and compiling pages into TechDocs.* |

$$\text{RICE Score} = \frac{100 \times 2.0 \times 0.90}{2} = 90.0$$

> **Calculated RICE Score:** `90.0`

### 🎯 Niche & Stack Alignment

*Explain how this experiment connects to highly specialized domain knowledge and a career-focused tech stack:*
- **Niche Domain Knowledge:** Ideal Customer Profile (ICP) definition, developer persona profiling, DevEx friction mapping (cognitive overload, service sprawl), and Backstage organization-model entity taxonomy (`Group` and `User` relations).
- **Career-Focused Stack:** Spotify's Backstage Developer Portal, MkDocs/TechDocs compilation pipelines, YAML configuration management, and Turborepo workspace patterns.
- **Dogfooding Component:** We are using our local developer portal organization tree to map out our own commercial buyers, verifying Backstage's capability to model human stakeholders alongside software components.

---

## 📈 3. Success Gates

### 🟢 The Green Gate (Primary Success Metric)
*The precise quantitative threshold that, if met or exceeded, validates the hypothesis.*
*   **Metric:** 100% of the primary target personas successfully cataloged as Backstage `User` / `Group` entities and their detailed profiles fully indexed under TechDocs.
*   **Baseline:** 0 personas cataloged.
*   **Target:** 2 primary personas fully registered, running, and accessible under the search indexing service.
*   **Measurement Source:** Backstage Catalog API and MkDocs site build verification.

### 🔴 The Red Gate (Guardrail Metrics)
*Critical operational or quality thresholds that must NOT degrade.*
*   **Schema Validity:** Zero validation errors on the catalog files (strictly compliant with Backstage Catalog Schema `backstage.io/v1alpha1`).
*   **Performance:** TechDocs compilation time must remain stable (not increase by > 10%).
*   **Workspace Integrity:** Zero linting, typechecking, or workspace validation breaks in `/Users/stefan/Code/monorepo`.

---

## 💻 4. Technical Scaffolding & Scope

### Isolated Directory Scaffolding
Following our scaffolding conventions, the target persona files and documentation will live in:
*   **Experiment Package Name:** `@cmp/exp-target-persona`
*   **Directory Path:** `docs/experiments/active/exp-003-target-persona/`

Inside this folder, we will structure:
```
docs/experiments/active/exp-003-target-persona/
├── catalog/
│   └── personas.yaml       # Backstage User & Group definitions for our target personas
└── documentation/
    ├── developer-persona.md    # Dan: The Overwhelmed Developer
    ├── lead-persona.md         # Lisa: The Platform Lead Buyer
    └── icp-framework.md        # Our target Ideal Customer Profile (ICP) details
```

---

## 🧪 5. Testing & Visual Validation Checklist

- [ ] **Catalog Schema Validation**: Programmatically audit that the persona catalog definitions strictly conform to the Backstage schema.
- [ ] **TechDocs Registration**: Add this active proposal to the experiments section in `mkdocs.yml`.
- [ ] **TechDocs Build Verification**: Run local TechDocs compiler to confirm the markdown files render with zero syntax or build errors.

---

## ⚖️ 6. Post-Experiment Evaluation

*To be filled out at the end of the experiment timeline.*

### Observed Metrics
*Compare the actual outcomes against the pre-defined gates.*

| Metric | Target | Actual | Gate Status |
| :--- | :--- | :--- | :--- |
| **Primary (Green)** | *2 target personas registered with TechDocs* | *TBD* | `PENDING` |
| **Schema Validity (Red 1)** | *0 schema errors* | *TBD* | `PENDING` |
| **Workspace Integrity (Red 2)** | *Pristine workspace validation* | *TBD* | `PENDING` |

### Key Learnings & Data Insights
*What did we learn? Did any unexpected user behaviors or side-effects occur?*

### The Decision
*Check one:*

*   [ ] **Option A: Persevere (Integrate & Scale)**
*   [ ] **Option B: Pivot (Cleanly Purge)**
