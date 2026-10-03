import SwiftUI
import CaptureCore
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: APIUser?
    @Published var navigationPath = NavigationPath()
    @Published var properties: [APIProperty] = []
    @Published var roomsByProperty: [String: [APIRoom]] = [:]
    @Published var graphService: GraphService?
    @Published var sessionState: CaptureSessionState?
    @Published var uploadQueue: OfflineUploadQueue
    @Published var lastError: String?
    @Published var isBusy = false

    let api: APIClient

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ViewraCapture", isDirectory: true)
        let storage: FileStorage = (try? DiskFileStorage(rootURL: docs)) ?? InMemoryFileStorage()
        self.api = APIClient(baseURL: APIClient.defaultBaseURL)
        self.uploadQueue = OfflineUploadQueue(storage: storage)
        self.uploadQueue.transport = APIUploadTransport(api: api)
        if api.hasStoredSession {
            isAuthenticated = true
            Task { await refreshMe() }
        }
    }

    func login(email: String, password: String, serverURL: String) async {
        isBusy = true
        defer { isBusy = false }
        do {
            try api.updateBaseURL(serverURL)
            // AutoFill / keyboard suggestions often append a space, which fails server-side email validation.
            let session = try await api.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            currentUser = session.user
            isAuthenticated = true
            lastError = nil
            await loadProperties()
            await processUploads()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func logout() {
        api.clearSession()
        isAuthenticated = false
        currentUser = nil
        properties = []
        roomsByProperty = [:]
        navigationPath = NavigationPath()
        graphService = nil
        sessionState = nil
    }

    func refreshMe() async {
        do {
            currentUser = try await api.me()
            await loadProperties()
            await processUploads()
        } catch APIError.unauthorized, APIError.noSession {
            logout()
        } catch {
            lastError = error.localizedDescription
        }
    }

    private var isProcessingUploads = false

    /// Drains due uploads; re-entrant calls are ignored so an item is never uploaded twice.
    func processUploads() async {
        guard !isProcessingUploads else { return }
        isProcessingUploads = true
        defer { isProcessingUploads = false; objectWillChange.send() }
        _ = try? await uploadQueue.processDue()
    }

    func retryUploads() async {
        uploadQueue.resetExhausted()
        await processUploads()
    }

    /// Creates the node on the server first so photo uploads target a real node id.
    func createCaptureNode(property: APIProperty, room: APIRoom, direction: ConnectionDirection, branchFrom: String? = nil) async throws -> Node {
        guard let graph = graphService else { throw APIError.message("No active capture session") }
        let fromId = branchFrom ?? graph.store.currentNodeId
        let label = "N\(graph.store.nodes.count + 1)"
        let remote = try await api.createNode(
            propertyId: property.id, roomId: room.id, label: label,
            connectFromNodeId: fromId, connectionDirection: fromId == nil ? nil : direction.rawValue
        )
        let node: Node
        if let branchFrom {
            node = try graph.createBranch(label: remote.label, fromNodeId: branchFrom, direction: direction, id: remote.id)
        } else {
            node = try graph.createNode(label: remote.label, direction: direction, id: remote.id)
        }
        sessionState?.currentNodeId = node.id
        sessionState?.nodes.append(node)
        sessionState?.connections = graph.store.connections
        sessionState?.currentNodeCompletedPhotos = []
        roomSummaries[room.id, default: RoomSummary()].nodeCount += 1
        return node
    }

    func loadProperties() async {
        do { properties = try await api.listProperties() }
        catch { lastError = error.localizedDescription }
    }

    func loadRooms(for propertyId: String) async {
        do { roomsByProperty[propertyId] = try await api.listRooms(propertyId: propertyId) }
        catch { lastError = error.localizedDescription }
    }

    /// Loads the room's saved nodes (server photos + uploads still queued on this device) so capture resumes instead of restarting.
    func beginCapture(property: APIProperty, room: APIRoom) async {
        let prop = Property(id: property.id, organizationId: property.organizationId, title: property.title, slug: property.slug, publicId: property.publicId, status: .draft)
        let rm = Room(id: room.id, propertyId: property.id, name: room.name, type: RoomType(rawValue: room.type) ?? .other, order: room.order)

        var nodes: [Node] = []
        var connections: [Connection] = []
        do {
            let graph = try await api.getGraph(propertyId: property.id)
            nodes = graph.nodes.filter { $0.roomId == room.id }.sorted { $0.sequence < $1.sequence }.map { remote in
                let captured = capturedDirections(nodeId: remote.id, serverPhotos: remote.photos)
                let skipped = Set((remote.skippedDirections ?? []).compactMap(PhotoDirection.init(rawValue:)))
                var node = Node(id: remote.id, propertyId: property.id, roomId: room.id, label: remote.label,
                                sequence: remote.sequence, completedPhotos: captured, skippedDirections: skipped)
                node.status = node.isPhotoComplete ? .complete : .capturing
                return node
            }
            let ids = Set(nodes.map(\.id))
            connections = graph.connections.filter { ids.contains($0.fromNodeId) && ids.contains($0.toNodeId) }.map {
                Connection(id: $0.id, propertyId: property.id, fromNodeId: $0.fromNodeId, toNodeId: $0.toNodeId,
                           direction: ConnectionDirection(rawValue: $0.direction) ?? .custom, label: $0.label)
            }
        } catch {
            lastError = error.localizedDescription
        }

        let resumeId = (nodes.first { !$0.isPhotoComplete } ?? nodes.last)?.id
        graphService = GraphService(store: GraphStore(propertyId: property.id, roomId: room.id, nodes: nodes, connections: connections, currentNodeId: resumeId))
        sessionState = CaptureSessionState(
            property: prop, room: rm, currentNodeId: resumeId, nodes: nodes, connections: connections,
            currentNodeCompletedPhotos: nodes.first { $0.id == resumeId }?.completedPhotos ?? []
        )
    }

    private func capturedDirections(nodeId: String, serverPhotos: [APIPhoto]) -> Set<PhotoDirection> {
        let uploaded = serverPhotos.filter { $0.processingStatus != "PENDING_UPLOAD" }.compactMap { PhotoDirection(rawValue: $0.direction) }
        let queued = uploadQueue.items.filter { $0.nodeId == nodeId && $0.status != .cancelled }.map(\.direction)
        return Set(uploaded).union(queued)
    }

    struct RoomSummary: Hashable {
        var nodeCount = 0
        var completeCount = 0
        var photoCount = 0
    }

    @Published var roomSummaries: [String: RoomSummary] = [:]
    /// Newest node with photos, so previews open on the operator's own capture.
    @Published var latestCapturedNodeId: String?

    func loadRoomSummaries(propertyId: String) async {
        guard let graph = try? await api.getGraph(propertyId: propertyId) else { return }
        latestCapturedNodeId = graph.nodes
            .filter { !capturedDirections(nodeId: $0.id, serverPhotos: $0.photos).isEmpty }
            .max { $0.sequence < $1.sequence }?.id
        var summaries: [String: RoomSummary] = [:]
        for remote in graph.nodes {
            let captured = capturedDirections(nodeId: remote.id, serverPhotos: remote.photos)
            let skipped = Set((remote.skippedDirections ?? []).compactMap(PhotoDirection.init(rawValue:)))
            var summary = summaries[remote.roomId, default: RoomSummary()]
            summary.nodeCount += 1
            summary.photoCount += captured.count
            if PhotoDirection.isComplete(captured: captured, skipped: skipped) { summary.completeCount += 1 }
            summaries[remote.roomId] = summary
        }
        roomSummaries = summaries
    }

    /// Persists the current node's skipped directions; reverts locally if the server rejects it.
    func setSkipped(_ direction: PhotoDirection, skipped: Bool) async -> Bool {
        guard var session = sessionState, let nodeId = session.currentNodeId else { return false }
        let previous = session
        if skipped {
            guard session.markDirectionSkipped(direction) else { return false }
        } else {
            session.unskipDirection(direction)
        }
        sessionState = session
        do {
            try await api.updateSkippedDirections(nodeId: nodeId, directions: session.currentNodeSkippedDirections.map(\.rawValue).sorted())
            return true
        } catch {
            sessionState = previous
            lastError = error.localizedDescription
            return false
        }
    }
}

struct APIUploadTransport: UploadTransport {
    let api: APIClient
    func upload(item: UploadQueueItem, data: Data) async throws -> Int {
        let prep = try await api.requestPhotoUpload(nodeId: item.nodeId, direction: item.direction.rawValue, mimeType: item.mimeType, fileSize: item.fileSize)
        try await api.putPresigned(url: prep.uploadUrl, data: data, mimeType: item.mimeType)
        try await api.completePhotoUpload(photoId: prep.photoId)
        return data.count
    }
}
