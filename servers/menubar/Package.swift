// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MenuBar",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "MenuBar",
            targets: ["MenuBar"]
        )
    ],
    targets: [
        .executableTarget(
            name: "MenuBar",
            path: "Sources/MenuBar"
        )
    ]
)
