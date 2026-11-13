# YTMusicBar (`apps/ytm-menubar`)

**Status:** `PARKED (EXP-004)`

A SwiftPM macOS menu bar (`NSStatusItem` / SwiftUI `MenuBarExtra`) YouTube Music player backed by a headless/windowed Google Chrome instance controlled via the Chrome DevTools Protocol (`ChromePlayerHost`), with `MPNowPlayingInfoCenter` and `MPRemoteCommandCenter` media key sync (`NowPlayingSync`).

## Requirements

- `REQ-YTM-001`: `PlayerState` decodes JSON payloads (full, optional `artworkURL`, no-track) and exposes expected `PlayerState.empty` defaults.

Experiment record: [exp-004-macos-ytm-menubar-player.md](../../docs/experiments/archive/exp-004-macos-ytm-menubar-player.md)

## Build & Test

Run from `apps/ytm-menubar`:

```bash
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift build --build-system native
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift test --build-system native -Xswiftc -F -Xswiftc /Library/Developer/CommandLineTools/Library/Developer/Frameworks -Xlinker -F -Xlinker /Library/Developer/CommandLineTools/Library/Developer/Frameworks
```

## Known failures (observed)

- Google sign-in in embedded `WKWebView` with Safari UA showed `"Couldn't sign you in – This browser or app may not be secure"`.
- After signing in via the Chrome window and returning to background, the user observed the sign-in was lost (root cause not investigated).
