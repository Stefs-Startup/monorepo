# Iteration Log: EXP-004 — `YTMusicBar` (macOS YouTube Music Menu Bar Player)

> **Dates:** 2026-11-12 – 2026-11-13  
> **Outcome:** `PARKED` (code committed at [`apps/ytm-menubar/`](../../../apps/ytm-menubar/README.md))  
> **Archive Record:** [`exp-004-macos-ytm-menubar-player.md`](../archive/exp-004-macos-ytm-menubar-player.md)

---

## 1. Timeline (Observed Facts)

| Time (EST) | Event | Source |
| :--- | :--- | :--- |
| **21:31** | User requests a v0.1 macOS menu bar player focused on YouTube Music (Control Center Now Playing style, able to start YouTube Music itself). | Coordinator transcript (`2026-11-13T02:31:13Z`) |
| **~21:39** | `WKWebView` v0.1 reported built and verified (`swift build`, 4/4 `PlayerStateTests`, `.app` bundle + `codesign`, 2s launch smoke test). | Board #14 |
| **21:44** | **User-found defect #1:** User tests Google Sign-In and receives `"Couldn't sign you in — This browser or app may not be secure."` | Coordinator transcript (`2026-11-13T02:44:21Z`) |
| **21:47–21:51** | User asks about using the Chrome PWA invisibly and about a dedicated PWA. `builder-core` probes `/Applications/YouTube Music.app` and dedicated Chrome/PWA behavior on macOS 27.0.1 (`activationPolicy`, `MediaRemote`, AppleScript, `app_mode_loader`, `--headless=new`). | Board #17, #20 |
| **22:00** | User approves headless Chrome + CDP with automatic open/close background handoff. | Coordinator transcript (`2026-11-13T03:00:05Z`–`03:00:42Z`) |
| **~22:02** | Headless Chrome + CDP update reported built and verified (`swift build`, 4/4 `PlayerStateTests`, `.app` bundle + `codesign`, 2s launch smoke test). | Board #27 |
| **22:06** | **User-found defect #2:** User tests Sign In and reports sign-in failed in the Chrome window; asks why the agent did not test it itself. | Coordinator transcript (`2026-11-13T03:06:20Z`–`03:06:51Z`) |
| **22:08** | Reported verified again after removing `--remote-debugging-port` from `openInteractiveWindow()`. Verification ran standalone Chrome CLI commands in `/tmp/ytm-signin-test` and `/tmp/ytm-headless-test`, not the app's `ChromePlayerHost`. | Board #32, #33 |
| **08:00** | **User-found defect #3:** User tests the app and reports `"Timed out waiting for chrome devtools port"`, calling out bad E2E testing practices and validation. | Coordinator transcript (`2026-11-13T13:00:23Z`) |
| **08:01** | Inspection of the profile `Cookies` SQLite DB shows visitor cookies plus `accounts.google.com` `OTZ`, `SOCS`, and `__Host-GAPS` (no `SID` or `SAPISID`). | Coordinator transcript (step 163) |
| **08:05** | Coordinator edits `ChromePlayerHost.swift` directly, adds E2E tests, and reports 7/7 tests passing. | Coordinator transcript (`2026-11-13T13:05:27Z`–`08:05:35`) |
| **08:11** | **User-found defect #4:** User tests again and reports sign-in is lost after returning to background; experiment parked to focus on the agentic memory and iteration harness. | Coordinator transcript (`2026-11-13T13:11:40Z`) |

---

## 2. Two-Way Judgment

### A. Thesis & Outcome Lens
- **Did it get us what we wanted?** No. At the time the cycle was parked, unauthenticated playback and headless CDP control worked in isolation, but the user could not sign in and keep the session across the background transition.
- **What we learned (facts):**
  - On macOS 27.0.1 with CommandLineTools-only (`No Xcode.app`), `MacOSX26.5.sdk` + `--build-system native` + `Testing.framework` `-F` flags builds and tests SwiftUI menu bar apps cleanly.
  - `WKWebView` with a Safari `customUserAgent` was rejected by `accounts.google.com` during live user sign-in.
  - `/Applications/YouTube Music.app` (`app_mode_loader`) runs with `activationPolicy = 0` (`.regular`), `MRMediaRemoteGetNowPlayingInfo` returns `[]` on macOS 27.0.1, and Chrome AppleScript JS execution is disabled by default (`error 12`).
  - Chrome `--headless=new --remote-debugging-port=0` runs with `activationPolicy = 2` (`.prohibited`, no Dock icon) and exposes CDP `Runtime.evaluate`.
- **Code facts (no causal claim):**
  - The Chrome stop routine signalled every process matching `--user-data-dir` (including Chrome helper processes).
  - No automated test checked cookie or session persistence across the windowed → `--headless=new` switch.
  - At 08:01, the profile's `Cookies` SQLite DB held only visitor cookies plus `accounts.google.com` `OTZ`, `SOCS`, and `__Host-GAPS` (no `SID`/`SAPISID`).
- **Open questions (unknown, not causes):**
  - Why was the Google Sign-In session absent after returning to background? Unknown whether it was due to signalling helper processes during shutdown, closing the window shortly after the first Google cookie appeared, or headless Chrome's handling of Keychain-encrypted cookies.
  - Would a clean/graceful Chrome shutdown after full sign-in completion preserve `SID`/`SAPISID` across the windowed → `--headless=new` transition? Untested.

### B. Builder & Process Lens
- **Velocity:**
  - **Wall-clock:** ~10h 40m total (21:31 → 08:11, including overnight gap 22:08–08:00; ~48m active).
  - **Build → user-test cycles:** 4 (`WKWebView` v0.1, Chrome+CDP v1, Chrome+CDP without `--remote-debugging-port`, Chrome+CDP with `SingletonLock`/timeout fix).
  - **Time to first real user test:** ~13 minutes (21:31 → 21:44).
  - **Time to falsify each approach:** `WKWebView` sign-in (~13m, user-found); existing Chrome PWA invisible/control (~4m probe); copied `app_mode_loader` (~3m probe); Chrome windowed → headless handoff (~2h 11m active/wall-clock across 3 user-found failures).
- **Process shortcomings (facts):**
  1. **UI and packaging built before testing the riskiest assumption:** Full SwiftUI `MenuBarExtra` UI, `NowPlayingSync`, and `.app` bundling were built before verifying Google Sign-In in `WKWebView`.
  2. **Verification did not cover the user's journey:** Reports #14 and #27 only ran `PlayerStateTests` (JSON decoding/state) and a 2-second app launch smoke test. Report #33 ran standalone `google-chrome` CLI commands in `/tmp`, not the app's `ChromePlayerHost` flow.
  3. **User found all 4 failures:** Every live failure (`WKWebView` OAuth rejection, Chrome `--remote-debugging-port` rejection, `SingletonLock` timeout, and lost sign-in on background return) was surfaced by the user.
  4. **Unreviewed coordinator edits:** In the 08:00–08:05 round, the coordinator edited `ChromePlayerHost.swift` directly with no independent review before reporting the fix.
  5. **Untracked code deleted:** `apps/ytm-menubar/` was untracked and deleted with `rm -rf` when initially parking, requiring restoration from session transcripts.
  6. **Hypotheses written as facts:** Early post-mortem and memory notes stated untested explanations (Keychain cookie encryption, async flush, and MiniTune's motive) as established causes.

---

## 3. Investor-Style Memo

- **Would we back the next cycle?** **Conditional.** The menu bar UI, SwiftPM build pipeline, and CDP playback control are already built and committed, so marginal cost to test a fix is low—**but** not under the previous build-and-guess process.
- **On what terms?**
  1. No UI or packaging changes until the auth + persistence path passes an automated integration check.
  2. Independent verification against the actual `ChromePlayerHost` (or replacement host), not `/tmp` CLI proxies.
  3. Any architectural change is reviewed by an agent that did not write the code.
- **Cheapest next proof:**
  - **Path 1 (Test the open question):** Write a minimal standalone test that signs into a test/real profile cleanly, shuts Chrome down gracefully (without killing helper processes mid-flush), relaunches `--headless=new` on the same `--user-data-dir`, and checks whether authenticated cookies (`SID`/`SAPISID`) and `isSignedIn` survive.
  - **Path 2 (Pivot to simpler architecture):** Prototype a minimal Manifest V3 / Safari Web Extension in the user's already-signed-in browser talking to `YTMusicBar` over `localhost` WebSocket / Native Messaging, eliminating separate Chrome lifecycle management altogether.
