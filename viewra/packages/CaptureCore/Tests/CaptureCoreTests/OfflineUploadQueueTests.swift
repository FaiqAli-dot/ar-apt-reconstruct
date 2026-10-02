import XCTest
@testable import CaptureCore

final class OfflineUploadQueueTests: XCTestCase {
    func testEnqueuePersistAndRetryWithExponentialBackoff() throws {
        let storage = InMemoryFileStorage()
        let policy = UploadRetryPolicy(
            maxAttempts: 4,
            initialDelay: 1.0,
            multiplier: 2.0,
            maxDelay: 60,
            jitterFraction: 0
        )
        let queue = OfflineUploadQueue(storage: storage, retryPolicy: policy)

        let payload = Data("photo-bytes".utf8)
        let item = try queue.enqueue(
            nodeId: "N1",
            propertyId: "P1",
            direction: .center,
            data: payload,
            id: "upload-1"
        )
        XCTAssertEqual(item.status, .pending)
        XCTAssertEqual(queue.pendingCount, 1)
        XCTAssertTrue(storage.exists("queue/payloads/upload-1.bin"))
        XCTAssertTrue(storage.exists("queue/manifest.json"))

        // Reload from storage
        let restored = OfflineUploadQueue(storage: storage, retryPolicy: policy)
        XCTAssertEqual(restored.items.count, 1)
        XCTAssertEqual(restored.items[0].id, "upload-1")

        let t0 = Date(timeIntervalSince1970: 1_700_000_000)
        try restored.recordFailureAndRetry(id: "upload-1", error: "network", now: t0)
        XCTAssertEqual(restored.items[0].attemptCount, 1)
        XCTAssertEqual(restored.items[0].status, .failed)
        XCTAssertEqual(
            restored.items[0].nextRetryAt,
            t0.addingTimeInterval(policy.deterministicDelay(forAttempt: 1))
        )
        XCTAssertEqual(policy.deterministicDelay(forAttempt: 1), 1.0)
        XCTAssertEqual(policy.deterministicDelay(forAttempt: 2), 2.0)
        XCTAssertEqual(policy.deterministicDelay(forAttempt: 3), 4.0)

        // Not due yet
        XCTAssertTrue(restored.dueItems(now: t0.addingTimeInterval(0.5)).isEmpty)
        // Due after backoff
        XCTAssertEqual(restored.dueItems(now: t0.addingTimeInterval(1.0)).count, 1)

        try restored.recordFailureAndRetry(id: "upload-1", error: "network", now: t0.addingTimeInterval(1))
        XCTAssertEqual(restored.items[0].attemptCount, 2)
        XCTAssertEqual(
            restored.items[0].nextRetryAt,
            t0.addingTimeInterval(1).addingTimeInterval(2.0)
        )

        // Progress: 0 while pending/failed with 0 bytes
        XCTAssertEqual(restored.progress, 0, accuracy: 0.001)

        try restored.markSucceeded(id: "upload-1", bytesUploaded: payload.count)
        XCTAssertEqual(restored.items[0].status, .succeeded)
        XCTAssertEqual(restored.progress, 1, accuracy: 0.001)
        XCTAssertFalse(storage.exists("queue/payloads/upload-1.bin"))
    }

    func testMaxRetriesExceeded() throws {
        let storage = InMemoryFileStorage()
        let policy = UploadRetryPolicy(maxAttempts: 2, initialDelay: 1, multiplier: 2, maxDelay: 10, jitterFraction: 0)
        let queue = OfflineUploadQueue(storage: storage, retryPolicy: policy)
        _ = try queue.enqueue(
            nodeId: "N1",
            propertyId: "P1",
            direction: .left,
            data: Data([1, 2, 3]),
            id: "u1"
        )
        try queue.recordFailureAndRetry(id: "u1", error: "fail1", now: Date())
        XCTAssertThrowsError(try queue.recordFailureAndRetry(id: "u1", error: "fail2", now: Date())) { error in
            guard case OfflineUploadError.maxRetriesExceeded("u1") = error else {
                return XCTFail("Expected maxRetriesExceeded, got \(error)")
            }
        }
    }
}
