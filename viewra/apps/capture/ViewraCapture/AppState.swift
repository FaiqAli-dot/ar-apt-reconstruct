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

    func login(email: String, password: String) async {
        isBusy = true
        defer { isBusy = false }
        do {
            let session = try await api.login(email: email, password: password)
            currentUser = session.user
            isAuthenticated = true
            lastError = nil
            await loadProperties()
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
        } catch {
            logout()
        }
    }

    func loadProperties() async {
        do { properties = try await api.listProperties() }
        catch { lastError = error.localizedDescription }
    }

    func loadRooms(for propertyId: String) async {
        do { roomsByProperty[propertyId] = try await api.listRooms(propertyId: propertyId) }
        catch { lastError = error.localizedDescription }
    }

    func beginCapture(property: APIProperty, room: APIRoom) {
        let prop = Property(id: property.id, organizationId: property.organizationId, title: property.title, slug: property.slug, publicId: property.publicId, status: .draft)
        let rm = Room(id: room.id, propertyId: property.id, name: room.name, type: RoomType(rawValue: room.type) ?? .other, order: room.order)
        graphService = GraphService(propertyId: property.id, roomId: room.id)
        sessionState = CaptureSessionState(property: prop, room: rm)
    }
}

struct APIUploadTransport: UploadTransport {
    let api: APIClient
    func upload(item: UploadQueueItem, data: Data) async throws -> Int {
        let prep = try await api.requestPhotoUpload(nodeId: item.nodeId, direction: item.direction.rawValue, mimeType: item.mimeType, fileSize: item.fileSize)
        try await api.putPresigned(url: prep.uploadUrl, data: data, mimeType: item.mimeType)
        _ = try await api.completePhotoUpload(photoId: prep.photoId)
        return data.count
    }
}
