import Foundation

enum APIError: LocalizedError {
    case invalidURL, http(Int, String), decoding(Error), unauthorized, noSession, message(String)
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid API URL"
        case .http(let code, let body): return "HTTP \(code): \(Self.readableMessage(from: body))"
        case .decoding(let err): return "Decode error: \(err.localizedDescription)"
        case .unauthorized: return "Unauthorized"
        case .noSession: return "Not signed in"
        case .message(let msg): return msg
        }
    }

    /// Turns the API's `{ message, details: [{ path, message }] }` error body into one line.
    private static func readableMessage(from body: String) -> String {
        struct Detail: Decodable { var path: String?; var message: String }
        struct ErrorBody: Decodable { var message: String?; var details: [Detail]? }
        guard let data = body.data(using: .utf8), let parsed = try? JSONDecoder().decode(ErrorBody.self, from: data) else { return body }
        if let details = parsed.details, !details.isEmpty {
            return details.map { [$0.path, $0.message].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: ": ") }.joined(separator: "; ")
        }
        return parsed.message ?? body
    }
}

struct APIUser: Codable, Hashable, Identifiable {
    var id: String; var organizationId: String; var name: String; var email: String; var role: String; var status: String
}

struct AuthSession: Codable {
    var accessToken: String; var refreshToken: String; var user: APIUser
}

struct APIProperty: Codable, Hashable, Identifiable {
    var id: String; var organizationId: String; var title: String; var slug: String; var publicId: String; var status: String; var description: String?
}

struct APIRoom: Codable, Hashable, Identifiable {
    var id: String; var propertyId: String; var name: String; var type: String; var order: Int
}

struct APINode: Codable, Hashable, Identifiable {
    var id: String; var propertyId: String; var roomId: String; var label: String; var sequence: Int; var status: String
    var skippedDirections: [String]?
}

struct APIPhoto: Codable, Hashable, Identifiable {
    var id: String; var direction: String; var processingStatus: String
}

struct APIGraphNode: Codable, Hashable, Identifiable {
    var id: String; var roomId: String; var label: String; var sequence: Int; var status: String
    var skippedDirections: [String]?
    var photos: [APIPhoto]
}

struct APIGraph: Codable {
    var nodes: [APIGraphNode]; var connections: [APIConnection]
}

struct APIConnection: Codable, Hashable, Identifiable {
    var id: String; var propertyId: String; var fromNodeId: String; var toNodeId: String; var direction: String; var label: String?
}

struct CreateConnectionResponse: Codable {
    var connection: APIConnection; var reverse: APIConnection?
}

struct PresignResponse: Codable {
    var photoId: String; var uploadUrl: String; var key: String
}

struct ItemsEnvelope<T: Codable>: Codable { var items: [T] }

struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) { encodeFunc = { try value.encode(to: $0) } }
    func encode(to encoder: Encoder) throws { try encodeFunc(encoder) }
}

final class APIClient: @unchecked Sendable {
    private static let baseURLKey = "viewra.apiBaseURL"
    /// Simulator shares the Mac's network, so localhost works there; a device needs the Mac's LAN address.
    static var defaultBaseURL: URL {
        if let saved = UserDefaults.standard.string(forKey: baseURLKey), let url = URL(string: saved) { return url }
        #if targetEnvironment(simulator)
        return URL(string: "http://localhost:3001")!
        #else
        return URL(string: "http://192.168.32.199:3001")!
        #endif
    }
    private(set) var baseURL: URL
    private let session: URLSession
    private let defaults = UserDefaults.standard
    private let accessKey = "viewra.accessToken"
    private let refreshKey = "viewra.refreshToken"

    func updateBaseURL(_ string: String) throws {
        var trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        if !trimmed.contains("://") { trimmed = "http://" + trimmed }
        guard let url = URL(string: trimmed), url.host != nil else { throw APIError.invalidURL }
        baseURL = url
        defaults.set(url.absoluteString, forKey: Self.baseURLKey)
    }
    private let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }()
    private let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    var hasStoredSession: Bool { defaults.string(forKey: accessKey) != nil }
    var accessToken: String? {
        get { defaults.string(forKey: accessKey) }
        set { defaults.set(newValue, forKey: accessKey) }
    }
    var refreshToken: String? {
        get { defaults.string(forKey: refreshKey) }
        set { defaults.set(newValue, forKey: refreshKey) }
    }
    func clearSession() { accessToken = nil; refreshToken = nil }

    func login(email: String, password: String) async throws -> AuthSession {
        let session: AuthSession = try await request(method: "POST", path: "/api/auth/login", body: ["email": email, "password": password], authed: false)
        accessToken = session.accessToken
        refreshToken = session.refreshToken
        return session
    }

    func me() async throws -> APIUser {
        struct Wrap: Codable { var user: APIUser }
        let wrap: Wrap = try await request(method: "GET", path: "/api/auth/me", body: Optional<String>.none, authed: true)
        return wrap.user
    }

    func listProperties() async throws -> [APIProperty] {
        let page: ItemsEnvelope<APIProperty> = try await request(method: "GET", path: "/api/properties", body: Optional<String>.none, authed: true)
        return page.items
    }

    func listRooms(propertyId: String) async throws -> [APIRoom] {
        let page: ItemsEnvelope<APIRoom> = try await request(method: "GET", path: "/api/properties/\(propertyId)/rooms", body: Optional<String>.none, authed: true)
        return page.items
    }

    func listNodes(propertyId: String) async throws -> [APINode] {
        let page: ItemsEnvelope<APINode> = try await request(method: "GET", path: "/api/properties/\(propertyId)/nodes", body: Optional<String>.none, authed: true)
        return page.items
    }

    func createPreviewLink(propertyId: String) async throws -> URL {
        struct PreviewLink: Codable { var url: String }
        let link: PreviewLink = try await request(method: "POST", path: "/api/properties/\(propertyId)/preview-link", body: Optional<String>.none, authed: true)
        guard let url = URL(string: link.url) else { throw APIError.invalidURL }
        return url
    }

    func getGraph(propertyId: String) async throws -> APIGraph {
        try await request(method: "GET", path: "/api/properties/\(propertyId)/graph", body: Optional<String>.none, authed: true)
    }

    func updateSkippedDirections(nodeId: String, directions: [String]) async throws {
        let _: APINode = try await request(method: "PATCH", path: "/api/nodes/\(nodeId)", body: ["skippedDirections": directions], authed: true)
    }

    func createNode(propertyId: String, roomId: String, label: String, connectFromNodeId: String?, connectionDirection: String?) async throws -> APINode {
        var body: [String: AnyEncodable] = ["roomId": AnyEncodable(roomId), "label": AnyEncodable(label)]
        if let connectFromNodeId { body["connectFromNodeId"] = AnyEncodable(connectFromNodeId) }
        if let connectionDirection { body["connectionDirection"] = AnyEncodable(connectionDirection) }
        return try await request(method: "POST", path: "/api/properties/\(propertyId)/nodes", body: body, authed: true)
    }

    func createConnection(propertyId: String, fromNodeId: String, toNodeId: String, direction: String, bidirectional: Bool = false) async throws -> CreateConnectionResponse {
        let body: [String: AnyEncodable] = [
            "propertyId": AnyEncodable(propertyId),
            "fromNodeId": AnyEncodable(fromNodeId),
            "toNodeId": AnyEncodable(toNodeId),
            "direction": AnyEncodable(direction),
            "bidirectional": AnyEncodable(bidirectional),
        ]
        return try await request(method: "POST", path: "/api/connections", body: body, authed: true)
    }

    func requestPhotoUpload(nodeId: String, direction: String, mimeType: String, fileSize: Int) async throws -> PresignResponse {
        let body: [String: AnyEncodable] = [
            "direction": AnyEncodable(direction),
            "mimeType": AnyEncodable(mimeType),
            "fileSize": AnyEncodable(fileSize),
        ]
        return try await request(method: "POST", path: "/api/nodes/\(nodeId)/photos/upload", body: body, authed: true)
    }

    func putPresigned(url: String, data: Data, mimeType: String) async throws {
        guard let uploadURL = URL(string: url) else { throw APIError.invalidURL }
        var req = URLRequest(url: uploadURL)
        req.httpMethod = "PUT"
        req.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        req.httpBody = data
        let (_, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.http((response as? HTTPURLResponse)?.statusCode ?? -1, "Presigned upload failed")
        }
    }

    func completePhotoUpload(photoId: String) async throws {
        struct Ack: Codable { var id: String }
        let _: Ack = try await request(method: "POST", path: "/api/photos/\(photoId)/complete-upload", body: ["photoId": photoId], authed: true)
    }

    /// Refresh tokens are single-use on the server, so concurrent 401s must share one refresh call.
    private actor RefreshCoordinator {
        private var inFlight: Task<Void, Error>?
        func run(_ operation: @escaping @Sendable () async throws -> Void) async throws {
            if let inFlight { return try await inFlight.value }
            let task = Task { try await operation() }
            inFlight = task
            defer { inFlight = nil }
            try await task.value
        }
    }
    private let refreshCoordinator = RefreshCoordinator()

    private func refreshAccessToken() async throws {
        try await refreshCoordinator.run { [self] in
            guard let token = refreshToken else { throw APIError.noSession }
            let session: AuthSession = try await request(method: "POST", path: "/api/auth/refresh", body: ["refreshToken": token], authed: false, allowRefresh: false)
            accessToken = session.accessToken
            refreshToken = session.refreshToken
        }
    }

    private func request<Body: Encodable, Response: Decodable>(method: String, path: String, body: Body?, authed: Bool, allowRefresh: Bool = true) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(body)
        }
        if authed {
            guard let token = accessToken else { throw APIError.noSession }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.message("No HTTP response") }
        if http.statusCode == 401 {
            if authed && allowRefresh && refreshToken != nil {
                do { try await refreshAccessToken() } catch { throw APIError.unauthorized }
                return try await request(method: method, path: path, body: body, authed: authed, allowRefresh: false)
            }
            if !authed { throw APIError.message(APIError.http(401, String(data: data, encoding: .utf8) ?? "").errorDescription ?? "Unauthorized") }
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        do { return try decoder.decode(Response.self, from: data) }
        catch { throw APIError.decoding(error) }
    }
}
