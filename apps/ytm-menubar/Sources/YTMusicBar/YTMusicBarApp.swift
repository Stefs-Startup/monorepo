import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    var onTerminate: (@MainActor () -> Void)?

    func applicationWillTerminate(_ notification: Notification) {
        onTerminate?()
    }
}

@main
struct YTMusicBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var player = PlayerController()

    var body: some Scene {
        MenuBarExtra {
            MenuBarPlayerView(player: player)
                .onAppear {
                    appDelegate.onTerminate = { [player] in
                        player.shutdown()
                    }
                }
        } label: {
            Image(systemName: player.state.isPlaying ? "play.circle.fill" : "music.note")
                .accessibilityLabel("YouTube Music")
        }
        .menuBarExtraStyle(.window)
    }
}
