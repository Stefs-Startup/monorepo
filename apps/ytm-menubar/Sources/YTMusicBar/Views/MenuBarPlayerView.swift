import AppKit
import SwiftUI

struct MenuBarPlayerView: View {
    @Bindable var player: PlayerController

    @State private var isScrubbing = false
    @State private var scrubTime: Double = 0

    var body: some View {
        VStack(spacing: 0) {
            if !player.hasStarted {
                idleView
            } else {
                activePlayerView
            }
        }
        .frame(width: 320)
        .background(.ultraThinMaterial)
    }

    private var idleView: some View {
        VStack(spacing: 14) {
            Image(systemName: "music.note.list")
                .font(.system(size: 32, weight: .medium))
                .foregroundStyle(.secondary)

            VStack(spacing: 4) {
                Text("YouTube Music")
                    .font(.headline)
                Text("Start playback or sign in to control YouTube Music from your menu bar.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let error = player.errorMessage, !error.isEmpty {
                errorBanner(error)
            }

            Button("Start YouTube Music") {
                player.startYouTubeMusic()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Divider()
                .padding(.top, 4)

            HStack {
                Spacer()
                quitButton
            }
        }
        .padding(16)
    }

    private var activePlayerView: some View {
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                trackHeader

                if let error = player.errorMessage, !error.isEmpty {
                    errorBanner(error)
                }

                scrubberSection
                transportControls
            }
            .padding(16)

            Divider()

            footerBar
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(.caption)
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var trackHeader: some View {
        HStack(spacing: 12) {
            ArtworkView(urlString: player.state.artworkURL, size: 56)

            VStack(alignment: .leading, spacing: 3) {
                Text(displayTitle)
                    .font(.headline)
                    .foregroundStyle(player.state.hasTrack ? .primary : .secondary)
                    .lineLimit(1)

                Text(displaySubtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            if player.isLoading {
                ProgressView()
                    .controlSize(.small)
            }
        }
    }

    private var scrubberSection: some View {
        let duration = player.state.duration
        let hasDuration = duration > 0
        let displayedTime = isScrubbing ? scrubTime : min(player.state.currentTime, max(duration, 0))

        return VStack(spacing: 4) {
            Slider(
                value: Binding(
                    get: { hasDuration ? displayedTime : 0 },
                    set: { newValue in
                        scrubTime = newValue
                    }
                ),
                in: 0...max(duration, 1),
                onEditingChanged: { editing in
                    isScrubbing = editing
                    if !editing && hasDuration {
                        player.seek(to: scrubTime)
                    }
                }
            )
            .controlSize(.small)
            .disabled(!hasDuration)

            HStack {
                Text(hasDuration ? formatTime(displayedTime) : "0:00")
                Spacer()
                Text(hasDuration ? "-\(formatTime(max(0, duration - displayedTime)))" : "--:--")
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(.secondary)
        }
    }

    private var transportControls: some View {
        HStack(spacing: 28) {
            Button {
                player.previousTrack()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.title3)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!player.state.hasTrack)
            .accessibilityLabel("Previous Track")

            Button {
                player.togglePlayPause()
            } label: {
                Image(systemName: player.state.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(player.state.isPlaying ? "Pause" : "Play")

            Button {
                player.nextTrack()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title3)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!player.state.hasTrack)
            .accessibilityLabel("Next Track")
        }
        .padding(.vertical, 2)
    }

    private var footerBar: some View {
        HStack {
            Button {
                if player.isInteractiveWindowOpen {
                    player.startYouTubeMusic()
                } else {
                    player.openInteractiveWindow()
                }
            } label: {
                Label(interactiveWindowTitle, systemImage: interactiveWindowIcon)
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)

            Spacer()

            quitButton
        }
    }

    private var interactiveWindowTitle: String {
        if player.isInteractiveWindowOpen {
            return "Return to Background"
        }
        return player.state.isSignedIn ? "Open Window" : "Sign In"
    }

    private var interactiveWindowIcon: String {
        if player.isInteractiveWindowOpen {
            return "arrow.uturn.backward.circle"
        }
        return player.state.isSignedIn ? "macwindow" : "person.crop.circle"
    }

    private var quitButton: some View {
        Button("Quit") {
            NSApplication.shared.terminate(nil)
        }
        .buttonStyle(.plain)
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private var displayTitle: String {
        if player.state.hasTrack && !player.state.title.isEmpty {
            return player.state.title
        }
        return player.isLoading ? "Loading..." : "No Track Playing"
    }

    private var displaySubtitle: String {
        let parts = [player.state.artist, player.state.album].filter { !$0.isEmpty }
        if !parts.isEmpty {
            return parts.joined(separator: " — ")
        }
        return "YouTube Music"
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite && seconds >= 0 else { return "0:00" }
        let totalSeconds = Int(seconds.rounded(.down))
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let secs = totalSeconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }
}
