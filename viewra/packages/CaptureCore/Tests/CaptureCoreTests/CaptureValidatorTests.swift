import XCTest
@testable import CaptureCore

final class CaptureValidatorTests: XCTestCase {
    func testIncompleteCaptureMissingRequiredPhotos() {
        let validator = CaptureValidator()
        let result = validator.validate(
            nodeId: "N1",
            completedPhotos: [.left],
            qualitySamples: []
        )
        XCTAssertFalse(result.isComplete)
        XCTAssertFalse(result.isAcceptable)
        XCTAssertEqual(result.missingDirections, Set([.center, .right]))
        XCTAssertTrue(result.errors.contains { $0.code == .incompleteCapture })
        XCTAssertTrue(result.errors.contains { $0.code == .missingPhoto && $0.direction == .center })
        XCTAssertTrue(result.errors.contains { $0.code == .missingPhoto && $0.direction == .right })
    }

    func testCompleteCaptureWithDarkBlurWarningsAndUseAnyway() {
        let validator = CaptureValidator()
        let samples = [
            PhotoQualitySample(
                direction: .left,
                metrics: PhotoQualityMetrics(meanLuminance: 10, laplacianVariance: 200)
            ),
            PhotoQualitySample(
                direction: .center,
                metrics: PhotoQualityMetrics(meanLuminance: 120, laplacianVariance: 5)
            ),
        ]
        var result = validator.validate(
            nodeId: "N2",
            completedPhotos: [.left, .center, .right],
            qualitySamples: samples
        )
        XCTAssertTrue(result.isComplete)
        XCTAssertTrue(result.isAcceptable)
        XCTAssertEqual(result.warnings.count, 2)

        let darkId = "dark-N2-LEFT"
        XCTAssertTrue(result.warnings.contains { $0.id == darkId && $0.canUseAnyway && !$0.usedAnyway })

        result = validator.useAnyway(issueId: darkId, in: result)
        XCTAssertTrue(result.issues.first { $0.id == darkId }?.usedAnyway == true)

        let blurId = "blur-N2-CENTER"
        result = validator.useAnyway(issueId: blurId, in: result)
        XCTAssertTrue(result.issues.first { $0.id == blurId }?.usedAnyway == true)
    }

    func testImageQualityAnalyzerDetectsDarkRGBA() {
        var bytes: [UInt8] = []
        for _ in 0..<(8 * 8) {
            bytes.append(5)
            bytes.append(5)
            bytes.append(5)
            bytes.append(255)
        }
        let metrics = ImageQualityAnalyzer.analyzeRGBA(width: 8, height: 8, bytes: bytes)
        XCTAssertNotNil(metrics)
        XCTAssertLessThan(metrics!.meanLuminance, ImageQualityAnalyzer.darkLuminanceThreshold)
    }

    func testSessionPhotoProgress() {
        var session = CaptureSessionState(
            property: Property(title: "Test"),
            room: Room(propertyId: "p", name: "Living"),
            currentNodeId: "N1",
            nodes: [
                Node(id: "N1", propertyId: "p", roomId: "r", label: "N1", status: .capturing)
            ]
        )
        XCTAssertEqual(session.photoCompletionProgress, 0, accuracy: 0.001)
        session.markPhotoComplete(.left)
        XCTAssertEqual(session.photoCompletionProgress, 1.0 / 3.0, accuracy: 0.001)
        session.markPhotoComplete(.center)
        session.markPhotoComplete(.right)
        XCTAssertTrue(session.isCurrentNodeComplete)
        XCTAssertEqual(session.nodes[0].status, .complete)
    }
}
