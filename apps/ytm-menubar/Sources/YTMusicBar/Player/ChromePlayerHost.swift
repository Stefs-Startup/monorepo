import CoreGraphics
import Foundation
import SQLite3

private struct CDPTarget: Decodable {
    let type: String
    let url: String
    let webSocketDebuggerUrl: String?
}

@MainActor
final class ChromePlayerHost {
    static let chromeExecutablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    static let youtubeMusicURL = "https://music.youtube.com"

    let profileDirectory: URL

    var onStateUpdate: ((PlayerState) -> Void)?
    var onLoadingChange: ((Bool) -> Void)?
    var onInteractiveWindowChange: ((Bool) -> Void)?
    var onError: ((String?) -> Void)?

    private var activeProcess: Process?
    private var webSocketTask: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    private var launchTask: Task<Void, Never>?
    private var interactiveMonitorTask: Task<Void, Never>?
    private var activityToken: NSObjectProtocol?

    private var nextCommandID: Int = 1
    private var pendingCommands: [Int: CheckedContinuation<String?, Never>] = [:]
    private var isShuttingDown = false
    private var isTransitioning = false
    private var lastReportedPort: Int?
    private var recentStderr = ""

    init(profileDirectory: URL? = nil) {
        if let profileDirectory {
            self.profileDirectory = profileDirectory
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                ?? URL(fileURLWithPath: NSTemporaryDirectory())
            self.profileDirectory = appSupport
                .appendingPathComponent("YTMusicBar", isDirectory: true)
                .appendingPathComponent("ChromeProfile", isDirectory: true)
        }
    }

    func startHeadless() {
        guard !isShuttingDown else { return }
        launchTask?.cancel()
        launchTask = Task { [weak self] in
            await self?.launchChrome(headless: true, autoReturnOnSignIn: false)
        }
    }

    func openInteractiveWindow(autoReturnOnSignIn: Bool) {
        guard !isShuttingDown else { return }
        launchTask?.cancel()
        launchTask = Task { [weak self] in
            await self?.launchChrome(headless: false, autoReturnOnSignIn: autoReturnOnSignIn)
        }
    }

    func evaluate(_ javascript: String) {
        Task { [weak self] in
            _ = await self?.evaluateCDP(javascript)
        }
    }

    func updateAppNapActivity(isPlaying: Bool) {
        if isPlaying {
            if activityToken == nil {
                activityToken = ProcessInfo.processInfo.beginActivity(
                    options: .userInitiatedAllowingIdleSystemSleep,
                    reason: "Playing YouTube Music audio"
                )
            }
        } else if let token = activityToken {
            ProcessInfo.processInfo.endActivity(token)
            activityToken = nil
        }
    }

    func shutdown() {
        isShuttingDown = true
        launchTask?.cancel()
        launchTask = nil
        stopCurrentSession()
        updateAppNapActivity(isPlaying: false)
    }

    private func launchChrome(headless: Bool, autoReturnOnSignIn: Bool) async {
        guard FileManager.default.isExecutableFile(atPath: Self.chromeExecutablePath) else {
            onError?("Google Chrome not found at \(Self.chromeExecutablePath)")
            onLoadingChange?(false)
            return
        }

        isTransitioning = true
        stopCurrentSession()
        isTransitioning = false

        onError?(nil)
        onLoadingChange?(true)
        onInteractiveWindowChange?(!headless)

        do {
            try FileManager.default.createDirectory(at: profileDirectory, withIntermediateDirectories: true)
        } catch {
            onError?("Failed to create Chrome profile directory: \(error.localizedDescription)")
            onLoadingChange?(false)
            return
        }

        removeStaleProfileFiles()

        let devToolsPortFile = profileDirectory.appendingPathComponent("DevToolsActivePort")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: Self.chromeExecutablePath)

        var args = [
            "--user-data-dir=\(profileDirectory.path)",
            "--no-first-run",
            "--no-default-browser-check"
        ]
        if headless {
            args.append(contentsOf: [
                "--headless=new",
                "--remote-debugging-port=0",
                "--autoplay-policy=no-user-gesture-required",
                Self.youtubeMusicURL
            ])
        } else {
            args.append("--app=\(Self.youtubeMusicURL)")
        }
        process.arguments = args

        let stderrPipe = Pipe()
        process.standardError = stderrPipe
        process.standardOutput = FileHandle.nullDevice

        lastReportedPort = nil
        recentStderr = ""
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            let parsedPort = headless ? Self.parseDevToolsPort(from: text) : nil
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.appendStderr(text)
                if let port = parsedPort {
                    self.lastReportedPort = port
                }
            }
        }

        process.terminationHandler = { [weak self] terminated in
            stderrPipe.fileHandleForReading.readabilityHandler = nil
            Task { @MainActor [weak self] in
                guard let self, self.activeProcess === terminated else { return }
                self.activeProcess = nil
                self.cleanupCDPConnection()
                if !headless {
                    self.onInteractiveWindowChange?(false)
                    if !self.isShuttingDown && !self.isTransitioning {
                        self.startHeadless()
                    }
                }
            }
        }

        do {
            try process.run()
            activeProcess = process
        } catch {
            stderrPipe.fileHandleForReading.readabilityHandler = nil
            onError?("Failed to launch Chrome: \(error.localizedDescription)")
            onLoadingChange?(false)
            onInteractiveWindowChange?(false)
            return
        }

        if !headless {
            onLoadingChange?(false)
            startInteractiveMonitor(for: process, autoReturnOnSignIn: autoReturnOnSignIn)
            return
        }

        guard let port = await waitForCDPPort(devToolsPortFile: devToolsPortFile, process: process) else {
            if !Task.isCancelled && !isShuttingDown {
                let detail = recentStderr.trimmingCharacters(in: .whitespacesAndNewlines)
                if !process.isRunning {
                    let suffix = detail.isEmpty ? "exit \(process.terminationStatus)" : detail
                    onError?("Chrome exited before opening DevTools port (\(suffix)).")
                } else {
                    onError?("Timed out waiting for Chrome DevTools port.")
                }
                onLoadingChange?(false)
            }
            return
        }

        guard let wsURL = await waitForPageWebSocketURL(port: port, process: process) else {
            if !Task.isCancelled && !isShuttingDown {
                onError?("Could not connect to YouTube Music page in Chrome.")
                onLoadingChange?(false)
            }
            return
        }

        connectWebSocket(to: wsURL)
        onLoadingChange?(false)
        startPolling()
    }

    private func waitForCDPPort(devToolsPortFile: URL, process: Process) async -> Int? {
        for _ in 0..<150 {
            if Task.isCancelled || isShuttingDown {
                return nil
            }
            if let port = lastReportedPort {
                return port
            }
            if let contents = try? String(contentsOf: devToolsPortFile, encoding: .utf8),
               let firstLine = contents.split(separator: "\n").first,
               let port = Int(firstLine.trimmingCharacters(in: .whitespacesAndNewlines)),
               port > 0 {
                return port
            }
            if !process.isRunning {
                return nil
            }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        return nil
    }

    private func waitForPageWebSocketURL(port: Int, process: Process) async -> URL? {
        guard let listURL = URL(string: "http://127.0.0.1:\(port)/json/list") else { return nil }

        for _ in 0..<50 {
            if Task.isCancelled || isShuttingDown || !process.isRunning {
                return nil
            }
            if let (data, _) = try? await URLSession.shared.data(from: listURL),
               let targets = try? JSONDecoder().decode([CDPTarget].self, from: data) {
                let pages = targets.filter { $0.type == "page" && $0.webSocketDebuggerUrl != nil }
                let preferred = pages.first(where: { $0.url.contains("music.youtube.com") }) ?? pages.first
                if let wsString = preferred?.webSocketDebuggerUrl, let wsURL = URL(string: wsString) {
                    return wsURL
                }
            }
            try? await Task.sleep(nanoseconds: 150_000_000)
        }
        return nil
    }

    private func connectWebSocket(to url: URL) {
        cleanupCDPConnection()
        let task = URLSession.shared.webSocketTask(with: url)
        self.webSocketTask = task
        task.resume()

        receiveTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                do {
                    let message = try await task.receive()
                    switch message {
                    case .string(let text):
                        self.handleCDPMessage(text)
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            self.handleCDPMessage(text)
                        }
                    @unknown default:
                        break
                    }
                } catch {
                    break
                }
            }
        }
    }

    private func handleCDPMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = json["id"] as? Int,
              let continuation = pendingCommands.removeValue(forKey: id) else {
            return
        }

        let resultObj = json["result"] as? [String: Any]
        let innerResult = resultObj?["result"] as? [String: Any]
        let value = innerResult?["value"] as? String
        continuation.resume(returning: value)
    }

    private func evaluateCDP(_ expression: String) async -> String? {
        guard let webSocketTask else { return nil }

        let commandID = nextCommandID
        nextCommandID += 1

        let payload: [String: Any] = [
            "id": commandID,
            "method": "Runtime.evaluate",
            "params": [
                "expression": expression,
                "returnByValue": true
            ]
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: data, encoding: .utf8) else {
            return nil
        }

        return await withCheckedContinuation { continuation in
            pendingCommands[commandID] = continuation
            webSocketTask.send(.string(jsonString)) { [weak self] error in
                if error != nil {
                    Task { @MainActor [weak self] in
                        if let pending = self?.pendingCommands.removeValue(forKey: commandID) {
                            pending.resume(returning: nil)
                        }
                    }
                }
            }
        }
    }

    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled, !self.isShuttingDown {
                if let jsonString = await self.evaluateCDP(YTMBridge.readStateJS),
                   let data = jsonString.data(using: .utf8),
                   let state = try? JSONDecoder().decode(PlayerState.self, from: data) {
                    self.onStateUpdate?(state)
                }
                try? await Task.sleep(nanoseconds: 500_000_000)
            }
        }
    }

    private func startInteractiveMonitor(for process: Process, autoReturnOnSignIn: Bool) {
        interactiveMonitorTask?.cancel()
        let pid = process.processIdentifier
        let hadAuthCookiesAtStart = autoReturnOnSignIn ? hasAuthCookies() : false

        interactiveMonitorTask = Task { [weak self] in
            var hasSeenWindow = false
            var zeroWindowStreak = 0
            var signedInStreak = 0

            while let self, !Task.isCancelled, !self.isShuttingDown, process.isRunning {
                try? await Task.sleep(nanoseconds: 400_000_000)
                if Task.isCancelled || self.isShuttingDown || !process.isRunning {
                    break
                }

                let windowCount = Self.visibleWindowCount(for: pid)
                if windowCount > 0 {
                    hasSeenWindow = true
                    zeroWindowStreak = 0
                } else if hasSeenWindow {
                    zeroWindowStreak += 1
                    if zeroWindowStreak >= 2 {
                        self.onInteractiveWindowChange?(false)
                        self.startHeadless()
                        return
                    }
                }

                if autoReturnOnSignIn && hasSeenWindow && !hadAuthCookiesAtStart && self.hasAuthCookies() {
                    signedInStreak += 1
                    if signedInStreak >= 4 {
                        self.onInteractiveWindowChange?(false)
                        self.startHeadless()
                        return
                    }
                } else {
                    signedInStreak = 0
                }
            }
        }
    }

    private func stopCurrentSession() {
        interactiveMonitorTask?.cancel()
        interactiveMonitorTask = nil
        cleanupCDPConnection()

        let pids = profileChromePIDs()
        activeProcess = nil

        if !pids.isEmpty {
            for pid in pids {
                kill(pid, SIGTERM)
            }
            let deadline = Date().addingTimeInterval(2.5)
            while Date() < deadline && pids.contains(where: { Self.isProcessAlive($0) }) {
                Thread.sleep(forTimeInterval: 0.05)
            }
            let survivors = pids.filter { Self.isProcessAlive($0) }
            if !survivors.isEmpty {
                for pid in survivors {
                    kill(pid, SIGKILL)
                }
                let killDeadline = Date().addingTimeInterval(0.3)
                while Date() < killDeadline && survivors.contains(where: { Self.isProcessAlive($0) }) {
                    Thread.sleep(forTimeInterval: 0.05)
                }
            }
        }

        removeStaleProfileFiles()
    }

    private func cleanupCDPConnection() {
        interactiveMonitorTask?.cancel()
        interactiveMonitorTask = nil
        pollTask?.cancel()
        pollTask = nil
        receiveTask?.cancel()
        receiveTask = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil

        let continuations = pendingCommands.values
        pendingCommands.removeAll()
        for continuation in continuations {
            continuation.resume(returning: nil)
        }
    }

    private func profileChromePIDs() -> [pid_t] {
        var pids = Set<pid_t>()
        let selfPID = getpid()

        if let process = activeProcess, process.isRunning {
            pids.insert(process.processIdentifier)
        }

        let lockURL = profileDirectory.appendingPathComponent("SingletonLock")
        if let target = try? FileManager.default.destinationOfSymbolicLink(atPath: lockURL.path),
           let dashIndex = target.lastIndex(of: "-"),
           let pid = Int32(target[target.index(after: dashIndex)...]),
           pid > 0 {
            pids.insert(pid)
        }

        let pgrep = Process()
        pgrep.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        pgrep.arguments = ["-f", "--", "--user-data-dir=\(profileDirectory.path)"]
        let stdout = Pipe()
        pgrep.standardOutput = stdout
        pgrep.standardError = FileHandle.nullDevice
        if (try? pgrep.run()) != nil {
            let data = stdout.fileHandleForReading.readDataToEndOfFile()
            pgrep.waitUntilExit()
            if let output = String(data: data, encoding: .utf8) {
                for line in output.split(whereSeparator: \.isNewline) {
                    if let pid = Int32(line.trimmingCharacters(in: .whitespaces)), pid > 0 {
                        pids.insert(pid)
                    }
                }
            }
        }

        pids.remove(selfPID)
        return Array(pids)
    }

    private func removeStaleProfileFiles() {
        for name in ["DevToolsActivePort", "SingletonLock", "SingletonCookie", "SingletonSocket"] {
            try? FileManager.default.removeItem(at: profileDirectory.appendingPathComponent(name))
        }
    }

    private func appendStderr(_ text: String) {
        recentStderr.append(text)
        if recentStderr.count > 1000 {
            recentStderr = String(recentStderr.suffix(1000))
        }
    }

    private func hasAuthCookies() -> Bool {
        let cookiesURL = profileDirectory
            .appendingPathComponent("Default", isDirectory: true)
            .appendingPathComponent("Cookies")
        guard FileManager.default.fileExists(atPath: cookiesURL.path) else {
            return false
        }

        var db: OpaquePointer?
        let uri = "file:\(cookiesURL.path)?mode=ro&nolock=1"
        guard sqlite3_open_v2(uri, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_URI, nil) == SQLITE_OK,
              let db else {
            if let db { sqlite3_close(db) }
            return false
        }
        defer { sqlite3_close(db) }

        let sql = """
        SELECT COUNT(*) FROM cookies
        WHERE (host_key LIKE '%youtube.com' OR host_key LIKE '%google.com')
          AND name IN ('SAPISID', '__Secure-3PAPISID', 'SID', 'LOGIN_INFO');
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else {
            return false
        }
        defer { sqlite3_finalize(stmt) }

        if sqlite3_step(stmt) == SQLITE_ROW {
            return sqlite3_column_int(stmt, 0) > 0
        }
        return false
    }

    private nonisolated static func visibleWindowCount(for pid: pid_t) -> Int {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
            as? [[String: Any]] else {
            return 0
        }
        var count = 0
        for win in list {
            let ownerPID = (win[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value
            let layer = (win[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 0
            if ownerPID == pid && layer == 0 {
                count += 1
            }
        }
        return count
    }

    private nonisolated static func isProcessAlive(_ pid: pid_t) -> Bool {
        if kill(pid, 0) == 0 {
            return true
        }
        return errno == EPERM
    }

    private nonisolated static func parseDevToolsPort(from text: String) -> Int? {
        // Loopback-only regex matching Chrome's local DevTools WebSocket URL.
        // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
        guard let range = text.range(of: #"ws://127\.0\.0\.1:(\d+)/"#, options: .regularExpression) else {
            return nil
        }
        let match = text[range]
        let digits = match.split(separator: ":").last?.split(separator: "/").first
        return digits.flatMap { Int($0) }
    }
}
