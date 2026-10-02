import Foundation

/// Uploader abstraction so CaptureCore stays free of networking frameworks.
public protocol UploadTransport: Sendable {
    /// Uploads payload; returns bytes acknowledged. Throws on failure.
    func upload(item: UploadQueueItem, data: Data) async throws -> Int
}

/// Persists and processes an offline photo upload queue with retry/backoff.
public final class OfflineUploadQueue: @unchecked Sendable {
    public private(set) var items: [UploadQueueItem] = []
    public let retryPolicy: UploadRetryPolicy
    public let storage: FileStorage
    public var transport: UploadTransport?

    private let manifestPath = "queue/manifest.json"
    private let lock = NSLock()
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    public init(
        storage: FileStorage,
        retryPolicy: UploadRetryPolicy = .default,
        transport: UploadTransport? = nil
    ) {
        self.storage = storage
        self.retryPolicy = retryPolicy
        self.transport = transport
        try? load()
    }

    /// Aggregate progress across all non-cancelled items (0...1).
    public var progress: Double {
        lock.lock()
        defer { lock.unlock() }
        let active = items.filter { $0.status != .cancelled }
        guard !active.isEmpty else { return 1 }
        let sum = active.reduce(0.0) { $0 + $1.progress }
        return sum / Double(active.count)
    }

    public var pendingCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return items.filter { $0.status == .pending || $0.status == .failed }.count
    }

    public var failedCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return items.filter { $0.status == .failed }.count
    }

    @discardableResult
    public func enqueue(
        nodeId: String,
        propertyId: String,
        direction: PhotoDirection,
        data: Data,
        mimeType: String = "image/jpeg",
        id: String? = nil
    ) throws -> UploadQueueItem {
        let itemId = id ?? UUID().uuidString
        let relativePath = "queue/payloads/\(itemId).bin"
        try storage.write(data, to: relativePath)

        let item = UploadQueueItem(
            id: itemId,
            nodeId: nodeId,
            propertyId: propertyId,
            direction: direction,
            localFilePath: relativePath,
            mimeType: mimeType,
            fileSize: data.count,
            status: .pending
        )

        lock.lock()
        items.append(item)
        lock.unlock()
        try persist()
        return item
    }

    public func item(id: String) -> UploadQueueItem? {
        lock.lock()
        defer { lock.unlock() }
        return items.first { $0.id == id }
    }

    /// Marks an item as failed and schedules retry using exponential backoff.
    public func scheduleRetry(id: String, error: String, now: Date = Date()) throws {
        lock.lock()
        guard let idx = items.firstIndex(where: { $0.id == id }) else {
            lock.unlock()
            throw OfflineUploadError.itemNotFound(id)
        }
        items[idx].attemptCount += 1
        items[idx].lastError = error
        items[idx].updatedAt = now

        if retryPolicy.shouldRetry(attempt: items[idx].attemptCount) {
            let delay = retryPolicy.deterministicDelay(forAttempt: items[idx].attemptCount)
            items[idx].status = .failed
            items[idx].nextRetryAt = now.addingTimeInterval(delay)
        } else {
            items[idx].status = .failed
            items[idx].nextRetryAt = nil
            lock.unlock()
            try persist()
            throw OfflineUploadError.maxRetriesExceeded(id)
        }
        lock.unlock()
        try persist()
    }

    /// Returns items that are due for retry (or never attempted).
    public func dueItems(now: Date = Date()) -> [UploadQueueItem] {
        lock.lock()
        defer { lock.unlock() }
        return items.filter { item in
            switch item.status {
            case .pending:
                return true
            case .failed:
                if let next = item.nextRetryAt {
                    return next <= now
                }
                return retryPolicy.shouldRetry(attempt: item.attemptCount)
            default:
                return false
            }
        }
    }

    /// Processes due items once. Returns succeeded ids.
    @discardableResult
    public func processDue(now: Date = Date()) async throws -> [String] {
        guard let transport else { return [] }
        let due = dueItems(now: now)
        var succeeded: [String] = []

        for item in due {
            do {
                try markUploading(id: item.id)
                let data = try storage.read(from: item.localFilePath)
                let bytes = try await transport.upload(item: item, data: data)
                try markSucceeded(id: item.id, bytesUploaded: bytes)
                succeeded.append(item.id)
            } catch let error as OfflineUploadError {
                if case .maxRetriesExceeded = error { continue }
                try? scheduleRetry(id: item.id, error: String(describing: error), now: now)
            } catch {
                try? scheduleRetry(id: item.id, error: error.localizedDescription, now: now)
            }
        }
        return succeeded
    }

    /// Simulates a failed attempt then retry scheduling (for unit tests without async transport).
    public func recordFailureAndRetry(id: String, error: String, now: Date = Date()) throws {
        try scheduleRetry(id: id, error: error, now: now)
    }

    public func markSucceeded(id: String, bytesUploaded: Int) throws {
        lock.lock()
        guard let idx = items.firstIndex(where: { $0.id == id }) else {
            lock.unlock()
            throw OfflineUploadError.itemNotFound(id)
        }
        items[idx].status = .succeeded
        items[idx].bytesUploaded = bytesUploaded
        items[idx].lastError = nil
        items[idx].nextRetryAt = nil
        items[idx].updatedAt = Date()
        let path = items[idx].localFilePath
        lock.unlock()
        try? storage.delete(path)
        try persist()
    }

    public func markUploading(id: String) throws {
        lock.lock()
        guard let idx = items.firstIndex(where: { $0.id == id }) else {
            lock.unlock()
            throw OfflineUploadError.itemNotFound(id)
        }
        items[idx].status = .uploading
        items[idx].updatedAt = Date()
        lock.unlock()
        try persist()
    }

    public func updateProgress(id: String, bytesUploaded: Int) throws {
        lock.lock()
        guard let idx = items.firstIndex(where: { $0.id == id }) else {
            lock.unlock()
            throw OfflineUploadError.itemNotFound(id)
        }
        items[idx].bytesUploaded = bytesUploaded
        items[idx].updatedAt = Date()
        lock.unlock()
        try persist()
    }

    public func cancel(id: String) throws {
        lock.lock()
        guard let idx = items.firstIndex(where: { $0.id == id }) else {
            lock.unlock()
            throw OfflineUploadError.itemNotFound(id)
        }
        items[idx].status = .cancelled
        items[idx].updatedAt = Date()
        let path = items[idx].localFilePath
        lock.unlock()
        try? storage.delete(path)
        try persist()
    }

    public func persist() throws {
        lock.lock()
        let snapshot = items
        lock.unlock()
        let data = try encoder.encode(snapshot)
        try storage.write(data, to: manifestPath)
    }

    public func load() throws {
        guard storage.exists(manifestPath) else {
            lock.lock()
            items = []
            lock.unlock()
            return
        }
        let data = try storage.read(from: manifestPath)
        let decoded = try decoder.decode([UploadQueueItem].self, from: data)
        lock.lock()
        items = decoded
        lock.unlock()
    }
}
