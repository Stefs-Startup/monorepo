# ADR-MEM-003: Park `EXP-004` (`YTMusicBar`) Committed in `apps/ytm-menubar/`

- **Status**: Accepted (2026-11-13)
- **Context**: `EXP-004` (`apps/ytm-menubar/`) hit unresolved user-reported sign-in and session-continuity failures across `WKWebView` (21:44) and Chrome `--app` / `--headless=new` handoff (22:06, 08:11), plus an orphaned-process DevTools port timeout (08:00). An earlier consolidation purged `apps/ytm-menubar/`, which discarded uncommitted/unarchived iteration code.
- **Decision**:
  - `EXP-004` is **PARKED**, not purged.
  - Keep `apps/ytm-menubar/` committed in the repository for future technical iteration, with its cycle findings recorded in `gotchas/browser-and-auth.md`, `gotchas/macos-media-and-windowing.md`, and `docs/experiments/iteration-log/`.
- **Consequences**: Future sessions can resume or pivot `EXP-004` from committed code and documented observations without losing work.
- **Evidence**: User directive #2 ("Everything should be commited for iteration later. Commit it.", coordinator transcript step [251], 2026-11-13) and board post #37 (2026-11-13).
