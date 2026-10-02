import Foundation

/// Protocol for persistent file storage used by the offline upload queue.
public protocol FileStorage: Sendable {
    func write(_ data: Data, to relativePath: String) throws
    func read(from relativePath: String) throws -> Data
    func delete(_ relativePath: String) throws
    func exists(_ relativePath: String) -> Bool
    func list(prefix: String) throws -> [String]
}

/// Disk-backed file storage rooted at a directory.
public final class DiskFileStorage: FileStorage, @unchecked Sendable {
    public let rootURL: URL

    public init(rootURL: URL) throws {
        self.rootURL = rootURL
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    public func write(_ data: Data, to relativePath: String) throws {
        let url = rootURL.appendingPathComponent(relativePath)
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: url, options: .atomic)
    }

    public func read(from relativePath: String) throws -> Data {
        try Data(contentsOf: rootURL.appendingPathComponent(relativePath))
    }

    public func delete(_ relativePath: String) throws {
        let url = rootURL.appendingPathComponent(relativePath)
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }

    public func exists(_ relativePath: String) -> Bool {
        FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(relativePath).path)
    }

    public func list(prefix: String) throws -> [String] {
        let base = rootURL.appendingPathComponent(prefix)
        guard FileManager.default.fileExists(atPath: base.path) else { return [] }
        let contents = try FileManager.default.contentsOfDirectory(atPath: base.path)
        return contents.map { prefix.isEmpty ? $0 : "\(prefix)/\($0)" }
    }
}

/// In-memory storage for tests.
public final class InMemoryFileStorage: FileStorage, @unchecked Sendable {
    private var files: [String: Data] = [:]
    private let lock = NSLock()

    public init() {}

    public func write(_ data: Data, to relativePath: String) throws {
        lock.lock()
        defer { lock.unlock() }
        files[relativePath] = data
    }

    public func read(from relativePath: String) throws -> Data {
        lock.lock()
        defer { lock.unlock() }
        guard let data = files[relativePath] else {
            throw OfflineUploadError.storageMissing(relativePath)
        }
        return data
    }

    public func delete(_ relativePath: String) throws {
        lock.lock()
        defer { lock.unlock() }
        files.removeValue(forKey: relativePath)
    }

    public func exists(_ relativePath: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return files[relativePath] != nil
    }

    public func list(prefix: String) throws -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return files.keys.filter { $0.hasPrefix(prefix) }.sorted()
    }
}
