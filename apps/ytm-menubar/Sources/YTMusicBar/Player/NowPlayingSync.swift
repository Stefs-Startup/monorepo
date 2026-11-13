import AppKit
import Foundation
import MediaPlayer

@MainActor
final class NowPlayingSync {
    struct Handlers {
        var onPlay: () -> Void
        var onPause: () -> Void
        var onTogglePlayPause: () -> Void
        var onNext: () -> Void
        var onPrevious: () -> Void
        var onSeek: (Double) -> Void
    }

    private let handlers: Handlers
    private var cachedArtworkURL: String?
    private var cachedArtwork: MPMediaItemArtwork?
    private var artworkTask: Task<Void, Never>?

    init(handlers: Handlers) {
        self.handlers = handlers
        configureRemoteCommands()
    }

    deinit {
        artworkTask?.cancel()
    }

    func update(with state: PlayerState) {
        let center = MPNowPlayingInfoCenter.default()

        guard state.hasTrack else {
            center.nowPlayingInfo = nil
            center.playbackState = .stopped
            return
        }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: state.title,
            MPMediaItemPropertyArtist: state.artist,
            MPMediaItemPropertyAlbumTitle: state.album,
            MPMediaItemPropertyPlaybackDuration: state.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: state.currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: state.isPlaying ? 1.0 : 0.0
        ]

        if let urlString = state.artworkURL, urlString == cachedArtworkURL, let cachedArtwork {
            info[MPMediaItemPropertyArtwork] = cachedArtwork
        } else if state.artworkURL != cachedArtworkURL {
            cachedArtworkURL = state.artworkURL
            cachedArtwork = nil
            fetchArtworkIfNeeded(urlString: state.artworkURL, currentState: state)
        }

        center.nowPlayingInfo = info
        center.playbackState = state.isPlaying ? .playing : .paused
    }

    private func fetchArtworkIfNeeded(urlString: String?, currentState: PlayerState) {
        artworkTask?.cancel()
        guard let urlString, let url = URL(string: urlString) else { return }

        artworkTask = Task { [weak self] in
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  !Task.isCancelled,
                  let image = NSImage(data: data) else {
                return
            }

            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            guard let self, self.cachedArtworkURL == urlString else { return }
            self.cachedArtwork = artwork

            var updatedInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            updatedInfo[MPMediaItemPropertyArtwork] = artwork
            MPNowPlayingInfoCenter.default().nowPlayingInfo = updatedInfo
        }
    }

    private func configureRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handlers.onPlay()
            }
            return .success
        }

        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handlers.onPause()
            }
            return .success
        }

        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handlers.onTogglePlayPause()
            }
            return .success
        }

        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handlers.onNext()
            }
            return .success
        }

        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handlers.onPrevious()
            }
            return .success
        }

        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            let targetTime = positionEvent.positionTime
            Task { @MainActor [weak self] in
                self?.handlers.onSeek(targetTime)
            }
            return .success
        }
    }
}
