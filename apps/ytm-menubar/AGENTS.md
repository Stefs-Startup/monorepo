# Agent Guidelines (`apps/ytm-menubar`)

## Build & Test

Run inside `apps/ytm-menubar`:

```bash
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift build --build-system native
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk swift test --build-system native -Xswiftc -F -Xswiftc /Library/Developer/CommandLineTools/Library/Developer/Frameworks -Xlinker -F -Xlinker /Library/Developer/CommandLineTools/Library/Developer/Frameworks
```

## Auth & Session Rule

- Any change to auth/session flow must ship with a test or a recorded manual check of sign-in → background → still signed in.
