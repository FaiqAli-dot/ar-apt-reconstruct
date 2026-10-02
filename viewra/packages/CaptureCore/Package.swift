// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CaptureCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v13),
    ],
    products: [
        .library(name: "CaptureCore", targets: ["CaptureCore"]),
    ],
    targets: [
        .target(name: "CaptureCore", path: "Sources/CaptureCore"),
        .testTarget(name: "CaptureCoreTests", dependencies: ["CaptureCore"], path: "Tests/CaptureCoreTests"),
    ]
)
