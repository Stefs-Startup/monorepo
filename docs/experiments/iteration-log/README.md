# Iteration Log

> **Purpose:** A two-way judgment log of our iteration cycles—tracking both **what we learned about the problem** and **how we built and verified it**. This is explicitly a **learning tool, not a gate**: nothing here blocks starting an experiment, and failed or parked cycles are committed so future iterations start from facts rather than guesswork.

---

## How Each Cycle Is Judged

Every entry evaluates a cycle through two lenses and closes with an investor-style memo:

### A. Thesis & Outcome Lens
- Did the approach get us what we wanted?
- What concrete facts did we learn about the problem, platform, or market?
- What remains unknown (open questions, not guessed causes)?

### B. Builder & Process Lens
- **Velocity:** Total wall-clock time, active engineering windows, number of `build → user-test` cycles, time to first real user test, and time to falsify each approach.
- **Verification quality:** How many defects were caught by automated checks vs. by the user? Did verification exercise the real production path and critical state transitions?
- **Process changes:** Concrete changes to how we scope, build, review, and test next time.

### Investor-Style Memo
- **Would we back the next cycle?** (`Yes` / `Conditional` / `No`)
- **On what terms?** (Scope, verification bar, and independence of review)
- **What is the cheapest next proof?** (The single smallest check that resolves the biggest unknown)

---

## Choosing More Pivotal Next Iterations

1. **Spend the first cycle on the assumption that kills the idea if false.** Do not build UI, packaging, or helper scripts before proving the riskiest external dependency (auth, OS entitlement, or state continuity) in isolation.
2. **Test the real transition, not a toy proxy.** A standalone CLI command in `/tmp` does not validate an app's process-management or cookie-persistence code.
3. **Separate facts from hypotheses.** Log observed outputs, timestamps, and error strings; list untested explanations as open questions until an experiment isolates them.
4. **Commit parked work.** Never `rm -rf` untracked experiment code; commit it in a parked state so the next cycle can inspect, bisect, or resume without reconstruction.

---

## Iteration Index

| Cycle | Dates | Wall-Clock | Build→User Cycles | User-Found Defects | Outcome | Verdict |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **[EXP-004: `YTMusicBar` (macOS YouTube Music Menu Bar Player)](./2026-11-exp-004-ytm-menubar.md)** | 2026-11-12 – 2026-11-13 | ~10h 40m (overnight; ~48m active) | 4 | 4 | `PARKED` (code committed at `apps/ytm-menubar/`) | Conditional — back only if next cycle isolates session persistence or pivots to an existing-browser bridge |
