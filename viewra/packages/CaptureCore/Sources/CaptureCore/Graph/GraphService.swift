import Foundation

/// Errors raised by graph mutation operations.
public enum GraphError: Error, Equatable, Sendable {
    case nodeNotFound(String)
    case connectionNotFound(String)
    case duplicateConnection(from: String, to: String)
    case selfConnection
    case emptyLabel
}

/// In-memory store for nodes and connections within a capture session.
public final class GraphStore: @unchecked Sendable {
    public private(set) var propertyId: String
    public private(set) var roomId: String
    public private(set) var nodes: [Node]
    public private(set) var connections: [Connection]
    public private(set) var currentNodeId: String?

    public init(
        propertyId: String,
        roomId: String,
        nodes: [Node] = [],
        connections: [Connection] = [],
        currentNodeId: String? = nil
    ) {
        self.propertyId = propertyId
        self.roomId = roomId
        self.nodes = nodes
        self.connections = connections
        self.currentNodeId = currentNodeId
    }

    public var currentNode: Node? {
        guard let currentNodeId else { return nil }
        return nodes.first { $0.id == currentNodeId }
    }

    public func node(id: String) -> Node? {
        nodes.first { $0.id == id }
    }

    public func containsNode(id: String) -> Bool {
        nodes.contains { $0.id == id }
    }

    /// Outgoing and incoming neighbor ids for a node.
    public func adjacency(of nodeId: String) -> (outgoing: [String], incoming: [String]) {
        let outgoing = connections
            .filter { $0.fromNodeId == nodeId }
            .map(\.toNodeId)
        let incoming = connections
            .filter { $0.toNodeId == nodeId }
            .map(\.fromNodeId)
        return (outgoing, incoming)
    }

    /// Full adjacency map: nodeId -> set of connected node ids (undirected).
    public func adjacencyMap() -> [String: Set<String>] {
        var map: [String: Set<String>] = [:]
        for node in nodes {
            map[node.id] = []
        }
        for connection in connections {
            map[connection.fromNodeId, default: []].insert(connection.toNodeId)
            map[connection.toNodeId, default: []].insert(connection.fromNodeId)
        }
        return map
    }

    func upsert(_ node: Node) {
        if let idx = nodes.firstIndex(where: { $0.id == node.id }) {
            nodes[idx] = node
        } else {
            nodes.append(node)
        }
    }

    func appendConnection(_ connection: Connection) throws {
        if connection.fromNodeId == connection.toNodeId {
            throw GraphError.selfConnection
        }
        let exists = connections.contains {
            $0.fromNodeId == connection.fromNodeId && $0.toNodeId == connection.toNodeId
        }
        if exists {
            throw GraphError.duplicateConnection(from: connection.fromNodeId, to: connection.toNodeId)
        }
        connections.append(connection)
    }

    func removeNode(id: String) {
        nodes.removeAll { $0.id == id }
        connections.removeAll { $0.fromNodeId == id || $0.toNodeId == id }
        if currentNodeId == id {
            currentNodeId = nodes.last?.id
        }
    }

    func setCurrent(_ nodeId: String?) {
        currentNodeId = nodeId
    }
}

/// Graph operations for capture workflow: create, branch, return, connect.
public final class GraphService: @unchecked Sendable {
    public let store: GraphStore

    public init(store: GraphStore) {
        self.store = store
    }

    public convenience init(propertyId: String, roomId: String) {
        self.init(store: GraphStore(propertyId: propertyId, roomId: roomId))
    }

    /// Creates a new node and auto-connects from the previous/current node when present.
    @discardableResult
    public func createNode(
        label: String,
        direction: ConnectionDirection = .forward,
        connectionLabel: String? = nil,
        id: String? = nil,
        connectFromPrevious: Bool = true
    ) throws -> Node {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw GraphError.emptyLabel }

        let previousId = store.currentNodeId
        let sequence = store.nodes.count
        let node = Node(
            id: id ?? UUID().uuidString,
            propertyId: store.propertyId,
            roomId: store.roomId,
            label: trimmed,
            sequence: sequence,
            status: .capturing
        )
        store.upsert(node)

        if connectFromPrevious, let previousId, previousId != node.id {
            let connection = Connection(
                propertyId: store.propertyId,
                fromNodeId: previousId,
                toNodeId: node.id,
                direction: direction,
                label: connectionLabel
            )
            try store.appendConnection(connection)
        }

        store.setCurrent(node.id)
        return node
    }

    /// Starts a branch from the current (or specified) node by creating a new child node.
    @discardableResult
    public func createBranch(
        label: String,
        fromNodeId: String? = nil,
        direction: ConnectionDirection,
        connectionLabel: String? = nil,
        id: String? = nil
    ) throws -> Node {
        let originId = fromNodeId ?? store.currentNodeId
        guard let originId, store.containsNode(id: originId) else {
            throw GraphError.nodeNotFound(fromNodeId ?? "current")
        }

        store.setCurrent(originId)
        return try createNode(
            label: label,
            direction: direction,
            connectionLabel: connectionLabel,
            id: id,
            connectFromPrevious: true
        )
    }

    /// Returns to an EXISTING node without copying. Sets it as current.
    @discardableResult
    public func returnToNode(id: String) throws -> Node {
        guard let existing = store.node(id: id) else {
            throw GraphError.nodeNotFound(id)
        }
        store.setCurrent(existing.id)
        return existing
    }

    /// Connects the current node to an existing target (or explicit from→to).
    @discardableResult
    public func connectExistingNode(
        to toNodeId: String,
        from fromNodeId: String? = nil,
        direction: ConnectionDirection = .custom,
        label: String? = nil,
        bidirectional: Bool = false
    ) throws -> Connection {
        let fromId = fromNodeId ?? store.currentNodeId
        guard let fromId else { throw GraphError.nodeNotFound("current") }
        guard store.containsNode(id: fromId) else { throw GraphError.nodeNotFound(fromId) }
        guard store.containsNode(id: toNodeId) else { throw GraphError.nodeNotFound(toNodeId) }

        let connection = Connection(
            propertyId: store.propertyId,
            fromNodeId: fromId,
            toNodeId: toNodeId,
            direction: direction,
            label: label
        )
        try store.appendConnection(connection)

        if bidirectional {
            let reverse = Connection(
                propertyId: store.propertyId,
                fromNodeId: toNodeId,
                toNodeId: fromId,
                direction: .back,
                label: label
            )
            try? store.appendConnection(reverse)
        }

        return connection
    }

    @discardableResult
    public func addConnection(
        from fromNodeId: String,
        to toNodeId: String,
        direction: ConnectionDirection = .custom,
        label: String? = nil
    ) throws -> Connection {
        guard store.containsNode(id: fromNodeId) else { throw GraphError.nodeNotFound(fromNodeId) }
        guard store.containsNode(id: toNodeId) else { throw GraphError.nodeNotFound(toNodeId) }

        let connection = Connection(
            propertyId: store.propertyId,
            fromNodeId: fromNodeId,
            toNodeId: toNodeId,
            direction: direction,
            label: label
        )
        try store.appendConnection(connection)
        return connection
    }

    public func deleteNode(id: String) throws {
        guard store.containsNode(id: id) else { throw GraphError.nodeNotFound(id) }
        store.removeNode(id: id)
    }

    public func adjacency(of nodeId: String) -> (outgoing: [String], incoming: [String]) {
        store.adjacency(of: nodeId)
    }

    public func adjacencyMap() -> [String: Set<String>] {
        store.adjacencyMap()
    }
}
