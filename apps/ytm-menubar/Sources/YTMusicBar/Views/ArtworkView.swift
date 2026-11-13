import SwiftUI

struct ArtworkView: View {
    let urlString: String?
    var size: CGFloat = 56

    var body: some View {
        AsyncImage(url: urlString.flatMap(URL.init(string:))) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            case .empty, .failure:
                placeholder
            @unknown default:
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(.primary.opacity(0.08), lineWidth: 0.5)
        )
    }

    private var placeholder: some View {
        ZStack {
            Color.secondary.opacity(0.15)
            Image(systemName: "music.note")
                .font(.title2)
                .foregroundStyle(.secondary)
        }
    }
}
