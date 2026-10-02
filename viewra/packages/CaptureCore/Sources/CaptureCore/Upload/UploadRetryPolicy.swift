import Foundation

/// Exponential backoff policy for failed upload retries.
public struct UploadRetryPolicy: Sendable, Equatable {
    public var maxAttempts: Int
    public var initialDelay: TimeInterval
    public var multiplier: Double
    public var maxDelay: TimeInterval
    public var jitterFraction: Double

    public init(
        maxAttempts: Int = 5,
        initialDelay: TimeInterval = 1.0,
        multiplier: Double = 2.0,
        maxDelay: TimeInterval = 60.0,
        jitterFraction: Double = 0.1
    ) {
        self.maxAttempts = maxAttempts
        self.initialDelay = initialDelay
        self.multiplier = multiplier
        self.maxDelay = maxDelay
        self.jitterFraction = jitterFraction
    }

    public static let `default` = UploadRetryPolicy()

    /// Delay before the given attempt number (1-based after a failure).
    public func delay(forAttempt attempt: Int) -> TimeInterval {
        guard attempt > 0 else { return 0 }
        let raw = initialDelay * pow(multiplier, Double(attempt - 1))
        let capped = min(raw, maxDelay)
        guard jitterFraction > 0 else { return capped }
        let jitter = capped * jitterFraction * Double.random(in: -1...1)
        return max(0, capped + jitter)
    }

    /// Deterministic delay without jitter (for tests).
    public func deterministicDelay(forAttempt attempt: Int) -> TimeInterval {
        guard attempt > 0 else { return 0 }
        let raw = initialDelay * pow(multiplier, Double(attempt - 1))
        return min(raw, maxDelay)
    }

    public func shouldRetry(attempt: Int) -> Bool {
        attempt < maxAttempts
    }
}

public enum UploadItemStatus: String, Codable, Sendable, Hashable {
    case pending
    case uploading
    case succeeded
    case failed
    case cancelled
}

public struct UploadQueueItem: Codable, Identifiable, Sendable, Hashable {
    public var id: String
    public var nodeId: String
    public var propertyId: String
    public var direction: PhotoDirection
    public var localFilePath: String
    public var mimeType: String
    public var fileSize: Int
    public var status: UploadItemStatus
    public var attemptCount: Int
    public var lastError: String?
    public var nextRetryAt: Date?
    public var createdAt: Date
    public var updatedAt: Date
    public var bytesUploaded: Int

    public init(
        id: String = UUID().uuidString,
        nodeId: String,
        propertyId: String,
        direction: PhotoDirection,
        localFilePath: String,
        mimeType: String = "image/jpeg",
        fileSize: Int = 0,
        status: UploadItemStatus = .pending,
        attemptCount: Int = 0,
        lastError: String? = nil,
        nextRetryAt: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        bytesUploaded: Int = 0
    ) {
        self.id = id
        self.nodeId = nodeId
        self.propertyId = propertyId
        self.direction = direction
        self.localFilePath = localFilePath
        self.mimeType = mimeType
        self.fileSize = fileSize
        self.status = status
        self.attemptCount = attemptCount
        self.lastError = lastError
        self.nextRetryAt = nextRetryAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.bytesUploaded = bytesUploaded
    }

    public var progress: Double {
        guard fileSize > 0 else { return status == .succeeded ? 1 : 0 }
        return min(1, Double(bytesUploaded) / Double(fileSize))
    }
}

public enum OfflineUploadError: Error, Equatable, Sendable {
    case storageMissing(String)
    case itemNotFound(String)
    case maxRetriesExceeded(String)
    case cancelled(String)
    case uploadFailed(String)
}
