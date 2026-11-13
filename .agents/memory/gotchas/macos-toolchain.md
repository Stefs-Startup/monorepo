# macOS Toolchain Gotchas

## SwiftPM on CommandLineTools-only macOS 27.0.1 (no `Xcode.app`)

- **Observed**:
  - `xcode-select -p` is `/Library/Developer/CommandLineTools`; `Xcode.app` (`xcodebuild`, `xcodegen`) is not installed.
  - Default `swift build` failed with `SessionFailedError`.
  - Building against `MacOSX27.0.sdk` failed on SwiftUI/Observation macros (`external macro implementation type 'SwiftUIMacros.StateMacro' could not be found`).
  - `swift test --build-system native` against `MacOSX26.5.sdk` failed with `no such module 'XCTest'` / `no such module 'Testing'` without explicit framework search paths.
- **Verified Workaround**:
  - Build with `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift build --build-system native`.
  - Test with `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift test --build-system native -Xswiftc -F -Xswiftc /Library/Developer/CommandLineTools/Library/Developer/Frameworks -Xlinker -F -Xlinker /Library/Developer/CommandLineTools/Library/Developer/Frameworks`.
- **Evidence**: Board posts #4, #11, #13, #14 (2026-11-12).
