import Foundation

/// Tracks in-progress capture for a property/room.
public struct CaptureSessionState: Codable, Sendable {
    public var property: Property
    public var room: Room
    public var currentNodeId: String?
    public var nodes: [Node]
    public var connections: [Connection]
    /// Directions completed on the current node.
    public var currentNodeCompletedPhotos: Set<PhotoDirection>
    public var startedAt: Date
    public var updatedAt: Date

    public init(
        property: Property,
        room: Room,
        currentNodeId: String? = nil,
        nodes: [Node] = [],
        connections: [Connection] = [],
        currentNodeCompletedPhotos: Set<PhotoDirection> = [],
        startedAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.property = property
        self.room = room
        self.currentNodeId = currentNodeId
        self.nodes = nodes
        self.connections = connections
        self.currentNodeCompletedPhotos = currentNodeCompletedPhotos
        self.startedAt = startedAt
        self.updatedAt = updatedAt
    }

    public var currentNode: Node? {
        guard let currentNodeId else { return nil }
        return nodes.first { $0.id == currentNodeId }
    }

    /// Directions skipped on the current node.
    public var currentNodeSkippedDirections: Set<PhotoDirection> {
        currentNode?.skippedDirections ?? []
    }

    /// 0...1 progress of required photos (captured or skipped) on the current node.
    public var photoCompletionProgress: Double {
        PhotoDirection.progress(captured: currentNodeCompletedPhotos, skipped: currentNodeSkippedDirections)
    }

    public var isCurrentNodeComplete: Bool {
        PhotoDirection.isComplete(captured: currentNodeCompletedPhotos, skipped: currentNodeSkippedDirections)
    }

    public mutating func markPhotoComplete(_ direction: PhotoDirection) {
        currentNodeCompletedPhotos.insert(direction)
        updateCurrentNode { node in
            node.completedPhotos.insert(direction)
            node.skippedDirections.remove(direction)
        }
    }

    /// Marks a direction as intentionally not photographed. Returns false if it would leave the node with no photos.
    @discardableResult
    public mutating func markDirectionSkipped(_ direction: PhotoDirection) -> Bool {
        guard let node = currentNode, !node.completedPhotos.contains(direction) else { return false }
        let skippedAfter = node.skippedDirections.union([direction])
        let remaining = Set(PhotoDirection.required).subtracting(skippedAfter).subtracting(node.completedPhotos)
        if node.completedPhotos.isEmpty && remaining.isEmpty { return false }
        updateCurrentNode { $0.skippedDirections.insert(direction) }
        return true
    }

    public mutating func unskipDirection(_ direction: PhotoDirection) {
        updateCurrentNode { $0.skippedDirections.remove(direction) }
    }

    private mutating func updateCurrentNode(_ change: (inout Node) -> Void) {
        if let idx = nodes.firstIndex(where: { $0.id == currentNodeId }) {
            change(&nodes[idx])
            nodes[idx].status = nodes[idx].isPhotoComplete ? .complete : .capturing
            nodes[idx].updatedAt = Date()
        }
        updatedAt = Date()
    }
}
