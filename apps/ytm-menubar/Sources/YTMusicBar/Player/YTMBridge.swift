import Foundation

enum YTMBridge {
    static let readStateJS: String = #"""
    (() => {
      const onYTM = location.hostname === "music.youtube.com";
      const navReady = !!document.querySelector("ytmusic-nav-bar");
      const hasSignInLink = !!document.querySelector('a.sign-in-link, ytmusic-nav-bar a[href*="ServiceLogin"]');
      const isSignedIn = onYTM && navReady && !hasSignInLink;

      const meta = navigator.mediaSession ? navigator.mediaSession.metadata : null;
      const video = document.querySelector("video");

      let artworkURL = null;
      if (meta && Array.isArray(meta.artwork) && meta.artwork.length > 0) {
        let bestArea = -1;
        for (const item of meta.artwork) {
          if (!item || !item.src) continue;
          let area = 0;
          if (typeof item.sizes === "string") {
            const parts = item.sizes.toLowerCase().split("x");
            if (parts.length === 2) {
              const w = parseInt(parts[0], 10) || 0;
              const h = parseInt(parts[1], 10) || 0;
              area = w * h;
            }
          }
          if (area >= bestArea) {
            bestArea = area;
            artworkURL = item.src;
          }
        }
      }

      const title = (meta && typeof meta.title === "string") ? meta.title : "";
      const artist = (meta && typeof meta.artist === "string") ? meta.artist : "";
      const album = (meta && typeof meta.album === "string") ? meta.album : "";
      const isPlaying = video ? !video.paused && !video.ended : false;
      const currentTime = (video && Number.isFinite(video.currentTime)) ? video.currentTime : 0;
      const duration = (video && Number.isFinite(video.duration)) ? video.duration : 0;

      return JSON.stringify({
        title,
        artist,
        album,
        artworkURL,
        isPlaying,
        currentTime,
        duration,
        isSignedIn
      });
    })();
    """#

    static let playPauseJS: String = #"""
    (() => {
      const btn = document.querySelector("#play-pause-button");
      if (btn) {
        btn.click();
        return true;
      }
      const video = document.querySelector("video");
      if (video) {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return true;
      }
      return false;
    })();
    """#

    static let nextJS: String = #"""
    (() => {
      const btn = document.querySelector(".next-button");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })();
    """#

    static let previousJS: String = #"""
    (() => {
      const btn = document.querySelector(".previous-button");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })();
    """#

    static func seekJS(to seconds: Double) -> String {
        let clamped = max(0, seconds)
        return """
        (() => {
          const video = document.querySelector("video");
          if (!video) return false;
          const target = Number.isFinite(video.duration) ? Math.min(\(clamped), video.duration) : \(clamped);
          video.currentTime = Math.max(0, target);
          return true;
        })();
        """
    }
}
