import Foundation

public struct PhotoQualityMetrics: Codable, Sendable, Hashable {
    public var meanLuminance: Double
    public var laplacianVariance: Double

    public init(meanLuminance: Double, laplacianVariance: Double) {
        self.meanLuminance = meanLuminance
        self.laplacianVariance = laplacianVariance
    }
}

/// Lightweight RGBA analysis (downscaled samples) without UIKit.
public enum ImageQualityAnalyzer: Sendable {
    public static let darkLuminanceThreshold: Double = 42
    public static let blurLaplacianThreshold: Double = 80

    public static func analyzeRGBA(
        width: Int,
        height: Int,
        bytes: [UInt8],
        bytesPerPixel: Int = 4
    ) -> PhotoQualityMetrics? {
        guard width > 2, height > 2, bytesPerPixel >= 3 else { return nil }

        var luminanceSum: Double = 0
        var count = 0
        for y in 0..<height {
            for x in 0..<width {
                let idx = (y * width + x) * bytesPerPixel
                guard idx + 2 < bytes.count else { continue }
                let r = Double(bytes[idx])
                let g = Double(bytes[idx + 1])
                let b = Double(bytes[idx + 2])
                luminanceSum += (r + g + b) / 3.0
                count += 1
            }
        }
        guard count > 0 else { return nil }
        let meanLuminance = luminanceSum / Double(count)

        var laplacian: [Double] = []
        for y in 1..<(height - 1) {
            for x in 1..<(width - 1) {
                func lum(_ px: Int, _ py: Int) -> Double {
                    let idx = (py * width + px) * bytesPerPixel
                    let r = Double(bytes[idx])
                    let g = Double(bytes[idx + 1])
                    let b = Double(bytes[idx + 2])
                    return (r + g + b) / 3.0
                }
                let center = lum(x, y)
                let value = abs(
                    4 * center - lum(x, y - 1) - lum(x, y + 1) - lum(x - 1, y) - lum(x + 1, y)
                )
                laplacian.append(value)
            }
        }

        let lapMean = laplacian.isEmpty
            ? 0
            : laplacian.reduce(0, +) / Double(laplacian.count)
        let lapVariance = laplacian.isEmpty
            ? 0
            : laplacian.reduce(0) { $0 + pow($1 - lapMean, 2) } / Double(laplacian.count)

        return PhotoQualityMetrics(
            meanLuminance: meanLuminance,
            laplacianVariance: lapVariance
        )
    }
}
