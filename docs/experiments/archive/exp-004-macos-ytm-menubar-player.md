# 🔬 Experiment Post-Mortem: EXP-004 — macOS YouTube Music Menu Bar Player (`YTMusicBar`)

> **Status:** `PARKED` (code committed at [`apps/ytm-menubar/`](../../../apps/ytm-menubar/README.md))  
> **Date:** 2026-11-12 – 2026-11-13  
> **Scope:** Standalone SwiftUI `MenuBarExtra` (`LSUIElement = true`) player for YouTube Music (`apps/ytm-menubar/`)  
> **Iteration Log:** [`2026-11-exp-004-ytm-menubar.md`](../iteration-log/2026-11-exp-004-ytm-menubar.md)

---

## 1. Goal

- **User Need**: A lightweight v0.1 macOS menu bar widget matching the native Control Center Now Playing layout (track artwork, title/artist, scrubber, play/pause, next, previous) focused solely on **YouTube Music**, improving on MiniTune by:
  1. Initiating YouTube Music directly from the menu bar (not requiring the user to open Safari first).
  2. Supporting the user's signed-in Google / YouTube Music account and playlists.
  3. Staying invisible (menu bar only, no Dock icon or persistent browser window).

---

## 2. Inspection Findings: `/Applications/MiniTune.app`

Inspection of `/Applications/MiniTune.app` (v1.0.38, `LSUIElement = true`) via `Info.plist`, `otool`, and bundle structure (board #4) observed:

- **UI & Windowing**: SwiftUI + AppKit (`NSStatusItem`, `NSVisualEffectView`, `StatusBarController`, `PanelDismissMonitor`).
- **Media & System Frameworks**: Links `MediaPlayer`, `MusicKit`, `SafariServices`, `Sparkle`, `Sentry`, and `MediaRemoteAdapter.framework`.
- **Browser Integration**: Contains **no `WKWebView`**. Integrates with external browsers via a Safari Extension (`MiniTuneSafariExtension.appex`), Chrome Native Messaging, AppleScript tab checks, and `MediaRemoteAdapter`.

---

## 3. Approaches Tested & Observed Outcomes (macOS 27.0.1)

| Approach | How It Works | Observed Result on macOS 27.0.1 | Outcome |
| :--- | :--- | :--- | :--- |
| **1. Embedded `WKWebView` + Safari `customUserAgent`** | SwiftUI `MenuBarExtra(.window)` + `WKWebView` (`WKWebsiteDataStore.default()`, `Version/18.0 Safari/605.1.15` UA) + `MPNowPlayingInfoCenter`. | Google Sign-In (`accounts.google.com`) rejected login in live user testing with `"Couldn't sign you in — This browser or app may not be secure"`. | **Stopped** (unauthenticated playback only) |
| **2. Controlling `/Applications/YouTube Music.app` (Chrome PWA)** | Launch existing Chrome PWA (`com.google.Chrome.app.cinhimbnkkaeohfgghhklpknlkffjgod`) in background (`activates = false, hides = true`) and read/control via `MediaRemote` or AppleScript. | 1. PWA has `activationPolicy = 0` (`.regular`) — hiding it hides the window, not the Dock icon.<br>2. `MRMediaRemoteGetNowPlayingInfo` returned `[]` in direct testing.<br>3. Chrome AppleScript `execute javascript` returned `error 12` unless *View > Developer > Allow JavaScript from Apple Events* is enabled. | **Not pursued** (Dock icon + manual Chrome setting) |
| **3. Copied `app_mode_loader` PWA with `LSUIElement = true`** | Copy `/Applications/YouTube Music.app` to `/tmp/YTMTest.app`, set `LSUIElement = true`, ad-hoc codesign. | `app_mode_loader` exited immediately when bundle ID/profile did not match Chrome's registered shortcut, and in normal operation binds to `Google Chrome.app`. | **Not pursued** |
| **4. Dedicated Chrome (`--headless=new` + CDP) with Interactive Window Handoff** | Run `--headless=new --remote-debugging-port=0` (`activationPolicy = 2`, zero Dock icon) over `URLSessionWebSocketTask`. Open windowed `--app=https://music.youtube.com` (no `--remote-debugging-port`) for sign-in, then transition back to `--headless=new`. | 1. Initial interactive launch passed `--remote-debugging-port=0` and failed Google Sign-In in user testing.<br>2. After removing `--remote-debugging-port`, user hit `"Timed out waiting for chrome devtools port"` due to orphaned processes holding `SingletonLock`.<br>3. After fixing `SingletonLock` cleanup, user signed in and returned to background, and the sign-in session was lost. Root cause was not isolated (stop routine signalled all processes matching `--user-data-dir`, and no test verified cookie survival across the switch; `Cookies` SQLite DB at 08:01 held only visitor cookies plus `accounts.google.com` `OTZ`, `SOCS`, `__Host-GAPS`, with no `SID`/`SAPISID`). | **Parked** (session lost on background return; root cause open) |

---

## 4. Toolchain, Testing & Process Facts

1. **CommandLineTools-only macOS (`No Xcode.app`)**:
   - `MacOSX27.0.sdk` fails on SwiftUI `@State`/`@Observable` macros; `MacOSX26.5.sdk` with `--build-system native` and `-F /Library/Developer/CommandLineTools/Library/Developer/Frameworks` builds and runs `Testing.framework` (`@Test`) cleanly.
2. **Process & Verification Shortcomings**:
   - **UI/packaging before core risk check**: SwiftUI UI, `NowPlayingSync`, and `.app` bundling were built before verifying Google Sign-In in `WKWebView`.
   - **Toy CLI checks instead of real-target E2E**: Earlier verification (#14, #27, #33) ran unit tests, 2s launch smoke tests, and standalone Chrome CLI commands in `/tmp`, not the app's `ChromePlayerHost` flow. The user surfaced all 4 live failures.
   - **`FileManager.fileExists` behavior on broken symlinks**: `SingletonLock` is a broken symlink (e.g., `Stefans-MacBook-Air.local-<pid>`), so `fileExists(atPath:)` returns `false`; `destinationOfSymbolicLink(atPath:)` is required to inspect it.
   - **Unreviewed coordinator edits & untracked deletion**: The coordinator edited `ChromePlayerHost.swift` directly in the 08:00–08:05 round without independent review, and untracked `apps/ytm-menubar/` files were deleted with `rm -rf` before being restored from session transcripts.

---

## 5. Open Questions & Candidate Next Paths

- **Open Questions**:
  - Whether the lost sign-in on background return was caused by signalling Chrome helper processes during shutdown, closing the window shortly after the first Google cookie appeared, or headless Chrome's handling of Keychain-encrypted cookies.
  - Whether a clean shutdown after full sign-in preserves `SID`/`SAPISID` across windowed → `--headless=new`.
- **Candidate Paths If Resumed**:
  1. Isolate and test `SID`/`SAPISID` persistence across a clean windowed → `--headless=new` transition in an automated test.
  2. Prototype a Manifest V3 Chrome extension (or Safari Web Extension) inside the user's already signed-in browser talking over `localhost` WebSocket / Native Messaging to `YTMusicBar`.

---

## 6. Disposition

- **Decision**: `PARKED` (code committed at [`apps/ytm-menubar/`](../../../apps/ytm-menubar/README.md) for future iteration) per [`docs/experiments/protocol.md`](../protocol.md).
- **Records Updated**: Iteration judgment logged in [`docs/experiments/iteration-log/2026-11-exp-004-ytm-menubar.md`](../iteration-log/2026-11-exp-004-ytm-menubar.md), platform facts recorded in [`.agents/memory/`](../../../.agents/memory/INDEX.md), and harness/memory practices documented in [`docs/software-factory/05-sota-agentic-memory-and-iteration-harness.md`](../../software-factory/05-sota-agentic-memory-and-iteration-harness.md).
