// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "YTMusicBar",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "YTMusicBar", targets: ["YTMusicBar"])
    ],
    targets: [
        .executableTarget(
            name: "YTMusicBar",
            path: "Sources/YTMusicBar"
        ),
        .testTarget(
            name: "YTMusicBarTests",
            dependencies: ["YTMusicBar"],
            path: "Tests/YTMusicBarTests"
        )
    ]
)
