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

    /// 0...1 progress of required photos on the current node.
    public var photoCompletionProgress: Double {
        Double(currentNodeCompletedPhotos.count) / Double(PhotoDirection.required.count)
    }

    public var isCurrentNodeComplete: Bool {
        PhotoDirection.required.allSatisfy { currentNodeCompletedPhotos.contains($0) }
    }

    public mutating func markPhotoComplete(_ direction: PhotoDirection) {
        currentNodeCompletedPhotos.insert(direction)
        if let idx = nodes.firstIndex(where: { $0.id == currentNodeId }) {
            nodes[idx].completedPhotos.insert(direction)
            if nodes[idx].isPhotoComplete {
                nodes[idx].status = .complete
            } else {
                nodes[idx].status = .capturing
            }
            nodes[idx].updatedAt = Date()
        }
        updatedAt = Date()
    }
}
