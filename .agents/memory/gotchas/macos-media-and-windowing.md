# macOS Media & Windowing Gotchas

## `MRMediaRemoteGetNowPlayingInfo` Returns Empty From Unentitled Process

- **Observed**: Calling `MRMediaRemoteGetNowPlayingInfo` (`MediaRemote.framework`) directly from an unentitled process on macOS 27.0.1 returned `[]` (`Title: nil`).
- **Evidence**: Board post #17 (2026-11-12 21:48).

## Chrome `--headless=new` vs PWA `activationPolicy` on macOS 27.0.1

- **Observed**:
  - Chrome launched with `--headless=new --remote-debugging-port=0` ran with `activationPolicy = 2` (`.prohibited`, no Dock icon, no visible window).
  - `/Applications/YouTube Music.app` (Chrome `app_mode_loader` PWA) ran with `activationPolicy = 0` (`.regular`, Dock icon present). Calling `NSWorkspace.OpenConfiguration` (`activates = false, hides = true`) or `System Events` hides its window, not its Dock icon.
- **Evidence**: Board posts #17, #20, #33 (2026-11-12).
