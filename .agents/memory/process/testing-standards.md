# Testing Standards

> **Motivation (2026-11-12/13 `EXP-004` session)**: Three consecutive `"verified"` reports preceded three user-found failures (21:44 `WKWebView` sign-in rejection, 22:06 `--app` + CDP sign-in failure, 08:00 orphaned Chrome `SingletonLock` DevTools port timeout), followed by a fourth user-found failure at 08:11 (sign-in lost when returning to background).

1. **Derive acceptance tests from the user's literal goal**: If the goal is `"sign in, return to background, still signed in"`, the acceptance test must exercise that exact end-to-end flow, not just build/unit checks.
2. **Test through the production entrypoint**: Run checks through the real app binary/entrypoint and real state paths, not ad-hoc shell commands in clean `/tmp` directories.
3. **Reproduce before fixing**: Reproduce every user-reported failure in an automated test (or documented reproduction) before writing the fix.
4. **Test dirty state and state continuity across transitions**: Exercise orphaned processes, stale locks (e.g., `SingletonLock` symlinks), existing profiles, and multi-step transitions (e.g., interactive window -> background headless handoff).
5. **Never claim `"verified end-to-end"` for unexercised paths**: List untested surfaces explicitly in every completion summary.
6. **Ask the user for human-only checks**: If a step requires human interaction (such as a live Google login), state that explicitly and ask the user to run that check instead of claiming the flow is done.
