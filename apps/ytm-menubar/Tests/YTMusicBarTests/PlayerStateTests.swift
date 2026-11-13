import Foundation
import Testing
@testable import YTMusicBar

// Traceability: REQ-YTM-001 (PlayerState JSON decoding & empty defaults)
@Suite("PlayerStateTests (REQ-YTM-001)")
struct PlayerStateTests {
    @Test("Decodes full PlayerState JSON payload")
    func decodesFullPayload() throws {
        let json = """
        {
            "title": "Midnight City",
            "artist": "M83",
            "album": "Hurry Up, We're Dreaming",
            "artworkURL": "https://lh3.googleusercontent.com/artwork.jpg",
            "isPlaying": true,
            "currentTime": 42.5,
            "duration": 243.0,
            "hasTrack": true,
            "isSignedIn": true
        }
        """
        let data = try #require(json.data(using: .utf8))
        let state = try JSONDecoder().decode(PlayerState.self, from: data)

        #expect(state.title == "Midnight City")
        #expect(state.artist == "M83")
        #expect(state.album == "Hurry Up, We're Dreaming")
        #expect(state.artworkURL == "https://lh3.googleusercontent.com/artwork.jpg")
        #expect(state.isPlaying == true)
        #expect(state.currentTime == 42.5)
        #expect(state.duration == 243.0)
        #expect(state.hasTrack == true)
        #expect(state.isSignedIn == true)
    }

    @Test("Decodes PlayerState JSON payload with missing optional artworkURL")
    func decodesMissingArtworkURL() throws {
        let json = """
        {
            "title": "Track Title",
            "artist": "Artist Name",
            "album": "",
            "isPlaying": false,
            "currentTime": 0,
            "duration": 180,
            "hasTrack": true,
            "isSignedIn": false
        }
        """
        let data = try #require(json.data(using: .utf8))
        let state = try JSONDecoder().decode(PlayerState.self, from: data)

        #expect(state.title == "Track Title")
        #expect(state.artist == "Artist Name")
        #expect(state.album == "")
        #expect(state.artworkURL == nil)
        #expect(state.isPlaying == false)
        #expect(state.currentTime == 0)
        #expect(state.duration == 180)
        #expect(state.hasTrack == true)
        #expect(state.isSignedIn == false)
    }

    @Test("Decodes no-track payload with hasTrack false")
    func decodesNoTrackState() throws {
        let json = """
        {
            "title": "",
            "artist": "",
            "album": "",
            "artworkURL": null,
            "isPlaying": false,
            "currentTime": 0.0,
            "duration": 0.0,
            "hasTrack": false,
            "isSignedIn": false
        }
        """
        let data = try #require(json.data(using: .utf8))
        let state = try JSONDecoder().decode(PlayerState.self, from: data)

        #expect(state.hasTrack == false)
        #expect(state.isPlaying == false)
        #expect(state.artworkURL == nil)
        #expect(state.isSignedIn == false)
        #expect(state == PlayerState.empty)
    }

    @Test("Empty static state has expected defaults")
    func emptyStateDefaults() {
        let empty = PlayerState.empty

        #expect(empty.title == "")
        #expect(empty.artist == "")
        #expect(empty.album == "")
        #expect(empty.artworkURL == nil)
        #expect(empty.isPlaying == false)
        #expect(empty.currentTime == 0)
        #expect(empty.duration == 0)
        #expect(empty.hasTrack == false)
        #expect(empty.isSignedIn == false)
    }
}
