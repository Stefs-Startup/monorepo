# 🔬 Experiments Portal

Welcome to the **CMP Experiments Portal**. In this organization, we treat all significant product features, optimizations, and technical architectures as scientific experiments. This approach ensures that every line of code we maintain delivers verified value and adheres to our lean, high-velocity engineering standards.

---

## 🧭 Navigation & Resources

-   **[The Experiment Protocol](protocol.md)**: Our core framework, lifecycle rules, success gating, and code cleanup standards.
-   **[Proposal Template](templates/proposal-template.md)**: The standard template used to plan, score, and log all experiments.

---

## 🏃 Active Experiments

These experiments are currently running or proposed. No code from these experiments is merged into the permanent codebase without passing their respective success gates.

| ID | Title | RICE Score | Owner | Target End Date | Status |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **EXP-001** | *Example: Backstage Self-Registration* | `45.5` | @sheldoncrosss | 2026-06-01 | `ACTIVE` |
| **EXP-002** | **[[STE-15] Market Audit Dogfooding Experiment](active/exp-002-market-audit.md)** | `63.33` | @sheldoncrosss | 2026-06-01 | `ACTIVE` |

---

## 📁 Archived Experiments

Records of completed experiments. These logs are preserved as institutional knowledge to document what succeeded (and was integrated) and what failed (and was cleanly purged).

| ID | Title | Decision | Date Completed | Learnings Summary |
| :--- | :--- | :--- | :---: | :--- |
| **EXP-000** | *Sample Experiment* | `PIVOT (Purged)` | 2026-05-10 | Scaffolding in apps/exp-sample proved hypothesis false; deleted codebase. |

---

## 🚀 How to Start an Experiment

1.  **Create a Proposal**: Copy the **[Proposal Template](templates/proposal-template.md)** to `docs/experiments/active/exp-[number]-[name].md`.
2.  **Score & Gate**: Fill out the hypothesis and RICE score, and define strict numeric Green and Red Gates.
3.  **Register Docs**: Add your proposal file to the navigation tree in `mkdocs.yml`.
4.  **Create Branch**: Check out a clean branch following `sheldoncrosss/exp-[number]-[name]`.
5.  **Build Isolated**: Scaffold your code under `apps/exp-[name]/` or `packages/exp-[name]/`.
