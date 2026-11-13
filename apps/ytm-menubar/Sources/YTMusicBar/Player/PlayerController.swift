import Foundation
import Observation

struct PlayerState: Codable, Equatable, Sendable {
    var title: String
    var artist: String
    var album: String
    var artworkURL: String?
    var isPlaying: Bool
    var currentTime: Double
    var duration: Double
    var isSignedIn: Bool

    var hasTrack: Bool {
        !title.isEmpty
    }

    static let empty = PlayerState(
        title: "",
        artist: "",
        album: "",
        artworkURL: nil,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        isSignedIn: false
    )
}

@MainActor
@Observable
final class PlayerController {
    var state: PlayerState = .empty
    var hasStarted: Bool = false
    var isLoading: Bool = false
    var isInteractiveWindowOpen: Bool = false
    var errorMessage: String?

    private let host: ChromePlayerHost
    private var nowPlayingSync: NowPlayingSync?

    init(profileDirectory: URL? = nil) {
        let host = ChromePlayerHost(profileDirectory: profileDirectory)
        self.host = host

        let sync = NowPlayingSync(
            handlers: NowPlayingSync.Handlers(
                onPlay: { [weak self] in
                    guard let self, !self.state.isPlaying else { return }
                    self.togglePlayPause()
                },
                onPause: { [weak self] in
                    guard let self, self.state.isPlaying else { return }
                    self.togglePlayPause()
                },
                onTogglePlayPause: { [weak self] in
                    self?.togglePlayPause()
                },
                onNext: { [weak self] in
                    self?.nextTrack()
                },
                onPrevious: { [weak self] in
                    self?.previousTrack()
                },
                onSeek: { [weak self] seconds in
                    self?.seek(to: seconds)
                }
            )
        )
        self.nowPlayingSync = sync

        host.onStateUpdate = { [weak self] newState in
            guard let self else { return }
            self.state = newState
            self.host.updateAppNapActivity(isPlaying: newState.isPlaying)
            self.nowPlayingSync?.update(with: newState)
        }

        host.onLoadingChange = { [weak self] loading in
            self?.isLoading = loading
        }

        host.onInteractiveWindowChange = { [weak self] isOpen in
            self?.isInteractiveWindowOpen = isOpen
        }

        host.onError = { [weak self] message in
            self?.errorMessage = message
        }
    }

    func startYouTubeMusic() {
        hasStarted = true
        host.startHeadless()
    }

    func openInteractiveWindow() {
        hasStarted = true
        host.openInteractiveWindow(autoReturnOnSignIn: !state.isSignedIn)
    }

    func togglePlayPause() {
        host.evaluate(YTMBridge.playPauseJS)
    }

    func nextTrack() {
        host.evaluate(YTMBridge.nextJS)
    }

    func previousTrack() {
        host.evaluate(YTMBridge.previousJS)
    }

    func seek(to seconds: Double) {
        host.evaluate(YTMBridge.seekJS(to: seconds))
    }

    func shutdown() {
        host.shutdown()
    }
}
