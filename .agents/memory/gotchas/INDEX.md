# Gotchas Index

> **Facts Only**: Every entry here records an observed symptom, verified behavior or workaround, and an `Evidence:` line (command/output + date or board post `#N`). Never record unverified causal hypotheses.

| File | Scope |
| :--- | :--- |
| [`macos-toolchain.md`](./macos-toolchain.md) | CommandLineTools-only macOS SwiftPM build & `Testing.framework` flags. |
| [`shell.md`](./shell.md) | macOS `/bin/bash` 3.2 incompatibilities (`declare -A` in `scripts/check.sh`). |
| [`browser-and-auth.md`](./browser-and-auth.md) | Chrome `SingletonLock` symlink, orphan process port timeout, `WKWebView` & Chrome sign-in observations, `app_mode_loader` copy, AppleScript JS default. |
| [`macos-media-and-windowing.md`](./macos-media-and-windowing.md) | `MediaRemote.framework` unentitled read, Chrome `--headless=new` vs PWA `activationPolicy`. |
