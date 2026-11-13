import Foundation
import Testing
@testable import YTMusicBar

@Suite("ChromePlayerHostE2ETests", .serialized)
@MainActor
struct ChromePlayerHostE2ETests {
    private static func makeTempProfile(prefix: String) throws -> URL {
        let dir = URL(fileURLWithPath: "/tmp/\(prefix)-\(UUID().uuidString.prefix(8))", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func waitUntil(timeoutSeconds: Double = 20.0, condition: @MainActor () -> Bool) async -> Bool {
        let deadline = Date().addingTimeInterval(timeoutSeconds)
        while Date() < deadline {
            if condition() {
                return true
            }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        return condition()
    }

    private static func matchingChromePIDs(profilePath: String) -> [Int32] {
        let pgrep = Process()
        pgrep.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        pgrep.arguments = ["-f", "--", "--user-data-dir=\(profilePath)"]
        let stdout = Pipe()
        pgrep.standardOutput = stdout
        pgrep.standardError = FileHandle.nullDevice
        guard (try? pgrep.run()) != nil else { return [] }
        let data = stdout.fileHandleForReading.readDataToEndOfFile()
        pgrep.waitUntilExit()
        guard let output = String(data: data, encoding: .utf8) else { return [] }
        return output.split(whereSeparator: \.isNewline).compactMap {
            Int32($0.trimmingCharacters(in: .whitespaces))
        }
    }

    @Test("Headless launch connects over CDP and polls PlayerState")
    func headlessLaunchAndCDPPoll() async throws {
        let profileDir = try Self.makeTempProfile(prefix: "ytm-e2e")
        let host = ChromePlayerHost(profileDirectory: profileDir)
        defer {
            host.shutdown()
            try? FileManager.default.removeItem(at: profileDir)
        }

        var receivedState: PlayerState?
        var lastError: String?
        var isLoading = true

        host.onStateUpdate = { state in
            receivedState = state
        }
        host.onError = { message in
            lastError = message
        }
        host.onLoadingChange = { loading in
            isLoading = loading
        }

        host.startHeadless()

        let gotState = await Self.waitUntil(timeoutSeconds: 20.0) {
            receivedState != nil || lastError != nil
        }

        #expect(gotState)
        #expect(lastError == nil)
        #expect(isLoading == false)
        #expect(receivedState != nil)
    }

    @Test("Recovers from an orphaned Chrome process holding SingletonLock")
    func recoversFromOrphanedChromeHoldingSingletonLock() async throws {
        let profileDir = try Self.makeTempProfile(prefix: "ytm-lock")
        let orphan = Process()
        orphan.executableURL = URL(fileURLWithPath: ChromePlayerHost.chromeExecutablePath)
        orphan.arguments = [
            "--user-data-dir=\(profileDir.path)",
            "--no-first-run",
            "--no-default-browser-check",
            "--headless=new",
            "about:blank"
        ]
        orphan.standardOutput = FileHandle.nullDevice
        orphan.standardError = FileHandle.nullDevice
        try orphan.run()

        let host = ChromePlayerHost(profileDirectory: profileDir)
        defer {
            host.shutdown()
            if orphan.isRunning {
                orphan.terminate()
            }
            try? FileManager.default.removeItem(at: profileDir)
        }

        let lockURL = profileDir.appendingPathComponent("SingletonLock")
        let lockAppeared = await Self.waitUntil(timeoutSeconds: 10.0) {
            (try? FileManager.default.destinationOfSymbolicLink(atPath: lockURL.path)) != nil && orphan.isRunning
        }
        #expect(lockAppeared)

        var receivedState: PlayerState?
        var lastError: String?
        host.onStateUpdate = { state in
            receivedState = state
        }
        host.onError = { message in
            lastError = message
        }

        host.startHeadless()

        let recovered = await Self.waitUntil(timeoutSeconds: 20.0) {
            receivedState != nil || lastError != nil
        }

        #expect(recovered)
        #expect(!orphan.isRunning)
        #expect(lastError == nil)
        #expect(receivedState != nil)
    }

    @Test("Transitions cleanly from interactive Chrome to headless CDP and shuts down")
    func transitionsFromInteractiveToHeadless() async throws {
        let profileDir = try Self.makeTempProfile(prefix: "ytm-trans")
        let host = ChromePlayerHost(profileDirectory: profileDir)
        defer {
            host.shutdown()
            try? FileManager.default.removeItem(at: profileDir)
        }

        var receivedState: PlayerState?
        var lastError: String?
        var interactiveOpen = false

        host.onStateUpdate = { state in
            receivedState = state
        }
        host.onError = { message in
            lastError = message
        }
        host.onInteractiveWindowChange = { isOpen in
            interactiveOpen = isOpen
        }

        host.openInteractiveWindow(autoReturnOnSignIn: false)
        let becameInteractive = await Self.waitUntil(timeoutSeconds: 10.0) {
            interactiveOpen && !Self.matchingChromePIDs(profilePath: profileDir.path).isEmpty
        }
        #expect(becameInteractive)

        host.startHeadless()
        let transitioned = await Self.waitUntil(timeoutSeconds: 20.0) {
            receivedState != nil || lastError != nil
        }

        #expect(transitioned)
        #expect(interactiveOpen == false)
        #expect(lastError == nil)
        #expect(receivedState != nil)

        host.shutdown()
        let cleanedUp = await Self.waitUntil(timeoutSeconds: 5.0) {
            Self.matchingChromePIDs(profilePath: profileDir.path).isEmpty
        }
        #expect(cleanedUp)
    }
}
