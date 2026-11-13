# Browser & Auth Gotchas

## Chrome `SingletonLock` Is a Symlink (`FileManager.fileExists` Returns `false`)

- **Observed**: In a Chrome `--user-data-dir` profile, `SingletonLock` is a symbolic link (`<hostname>-<pid>`). `FileManager.default.fileExists(atPath:)` returns `false` on broken symlinks, causing an E2E test for stale lock detection to fail. Switching to `FileManager.default.destinationOfSymbolicLink(atPath:)` read the symlink target and the E2E test passed.
- **Evidence**: Coordinator transcript steps [196], [199] (2026-11-13 08:05).

## Orphaned Chrome Process Holding `SingletonLock` Causes DevTools Port Timeout

- **Observed**: A Chrome process launched at 22:05 with `--remote-debugging-port=0 --app=https://music.youtube.com` remained running at 08:00 the next morning, holding `SingletonLock` on `~/Library/Application Support/YTMusicBar/ChromeProfile`. When `YTMusicBar` launched `--headless=new` against that profile, Chrome exited without writing `DevToolsActivePort` and the app reported `"Timed out waiting for Chrome DevTools port"`.
- **Evidence**: Coordinator transcript steps [155], [161], [199] (2026-11-13 08:00).

## Google Sign-In in `WKWebView`

- **Observed-by-user**: Signing into `accounts.google.com` inside `YTMusicBar`'s `WKWebView` failed with `"Couldn't sign you in — This browser or app may not be secure"` (`support.google.com/accounts/answer/7675428`).
- **Evidence**: User report at 2026-11-12 21:44 (coordinator transcript step [58]).

## Google Sign-In in Chrome Launched With `--remote-debugging-port`

- **Observed-by-user**: When Chrome was launched in `--app=https://music.youtube.com` mode with `--remote-debugging-port=0`, the user reported sign-in failed. Cause not isolated.
- **Evidence**: User report at 2026-11-12 22:06 (coordinator transcript step [131]).

## Session Loss Across Windowed `--app` -> `--headless=new` Chrome Handoff

- **Observed-by-user**: After signing in via the interactive Chrome `--app` window (launched without `--remote-debugging-port`) and returning to background (`--headless=new`), the user reported losing the sign-in session. Cause not isolated.
- **Evidence**: User report at 2026-11-13 08:11 (coordinator transcript step [200]).

## Copied Chrome `app_mode_loader` PWA Bundle Exits Immediately

- **Observed**: Copying `/Applications/YouTube Music.app` to `/tmp/YTMTest.app` with `LSUIElement = true` and ad-hoc codesigning caused `app_mode_loader` to exit immediately without launching a window.
- **Evidence**: Board post #20 (2026-11-12 21:51).

## Chrome AppleScript `execute javascript` Disabled by Default

- **Observed**: Running AppleScript `execute t javascript ...` against Chrome's `music.youtube.com` tab failed with `error 12` unless `View > Developer > Allow JavaScript from Apple Events` was manually enabled.
- **Evidence**: Board post #17 (2026-11-12 21:48).
