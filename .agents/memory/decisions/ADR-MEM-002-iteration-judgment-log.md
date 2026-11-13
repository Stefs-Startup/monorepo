# ADR-MEM-002: Two-Way Iteration Judgment Log (Replaces Feasibility Gate)

- **Status**: Accepted (2026-11-13) — replaces the prior pre-build hard-wall feasibility gate proposal.
- **Context**: Treating feasibility as a rigid pre-build blocker misframes how startup iteration works: experiments need an honest post-cycle understanding of both whether the product/approach is delivering what we want and how we are building and iterating (including velocity and investor perspective).
- **Decision**:
  - Feasibility is **not** a gate. Riskiest-assumption-first remains guidance only.
  - Record every iteration cycle in a **two-way judgment log** at [`docs/experiments/iteration-log/`](../../../docs/experiments/iteration-log/README.md) covering:
    1. **Thesis / Outcome lens**: did the cycle deliver the desired product behavior, and what changed in our understanding?
    2. **Builder / Process lens**: how was velocity, testing rigor, and engineering judgment (including an investor POV)?
- **Consequences**: Iteration cycles produce actionable, honest retrospection to steer the next technical pivot rather than binary stop/go checklists.
- **Evidence**: User directive #3 (coordinator transcript step [251], 2026-11-13) and board post #37 (2026-11-13).
