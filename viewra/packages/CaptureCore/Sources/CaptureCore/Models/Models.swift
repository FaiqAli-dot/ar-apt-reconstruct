import Foundation

public enum PhotoDirection: String, Codable, CaseIterable, Sendable, Hashable {
    case left = "LEFT"
    case center = "CENTER"
    case right = "RIGHT"
    public static let required: [PhotoDirection] = [.left, .center, .right]
}

public enum NodeStatus: String, Codable, Sendable, Hashable {
    case draft = "DRAFT"
    case capturing = "CAPTURING"
    case complete = "COMPLETE"
    case processing = "PROCESSING"
    case ready = "READY"
    case failed = "FAILED"
}

public enum ConnectionDirection: String, Codable, Sendable, Hashable {
    case forward = "FORWARD"
    case back = "BACK"
    case left = "LEFT"
    case right = "RIGHT"
    case up = "UP"
    case down = "DOWN"
    case custom = "CUSTOM"
}

public struct Position: Codable, Sendable, Hashable {
    public var x: Double
    public var y: Double
    public init(x: Double = 0, y: Double = 0) { self.x = x; self.y = y }
}

public struct CaptureMetadata: Codable, Sendable, Hashable {
    public var deviceModel: String?
    public var capturedAt: Date?
    public var operatorId: String?
    public var notes: String?
    public init(deviceModel: String? = nil, capturedAt: Date? = nil, operatorId: String? = nil, notes: String? = nil) {
        self.deviceModel = deviceModel; self.capturedAt = capturedAt; self.operatorId = operatorId; self.notes = notes
    }
}

public struct PropertyAddress: Codable, Sendable, Hashable {
    public var line1: String?; public var line2: String?; public var city: String?
    public var region: String?; public var postalCode: String?; public var country: String?
    public init(line1: String? = nil, line2: String? = nil, city: String? = nil, region: String? = nil, postalCode: String? = nil, country: String? = nil) {
        self.line1 = line1; self.line2 = line2; self.city = city; self.region = region; self.postalCode = postalCode; self.country = country
    }
}

public enum PropertyStatus: String, Codable, Sendable, Hashable {
    case draft = "DRAFT"; case processing = "PROCESSING"; case ready = "READY"; case published = "PUBLISHED"; case archived = "ARCHIVED"
}

public struct Property: Codable, Identifiable, Sendable, Hashable {
    public var id: String; public var organizationId: String; public var title: String; public var slug: String
    public var publicId: String; public var address: PropertyAddress?; public var description: String?
    public var status: PropertyStatus; public var coverPhotoId: String?; public var publishedAt: Date?
    public var createdAt: Date; public var updatedAt: Date
    public init(id: String = UUID().uuidString, organizationId: String = "", title: String, slug: String = "", publicId: String = "", address: PropertyAddress? = nil, description: String? = nil, status: PropertyStatus = .draft, coverPhotoId: String? = nil, publishedAt: Date? = nil, createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id; self.organizationId = organizationId; self.title = title
        self.slug = slug.isEmpty ? Self.slugify(title) : slug
        self.publicId = publicId; self.address = address; self.description = description
        self.status = status; self.coverPhotoId = coverPhotoId; self.publishedAt = publishedAt
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }
    private static func slugify(_ input: String) -> String {
        let mapped = input.lowercased().map { ($0.isLetter || $0.isNumber) ? $0 : Character("-") }
        return String(String(mapped).split(separator: "-", omittingEmptySubsequences: true).joined(separator: "-").prefix(200))
    }
}

public enum RoomType: String, Codable, Sendable, Hashable, CaseIterable {
    case livingRoom = "LIVING_ROOM"; case kitchen = "KITCHEN"; case bedroom = "BEDROOM"; case bathroom = "BATHROOM"
    case hallway = "HALLWAY"; case entrance = "ENTRANCE"; case balcony = "BALCONY"; case office = "OFFICE"
    case dining = "DINING"; case other = "OTHER"
}

public struct Room: Codable, Identifiable, Sendable, Hashable {
    public var id: String; public var propertyId: String; public var name: String; public var type: RoomType
    public var order: Int; public var createdAt: Date; public var updatedAt: Date
    public init(id: String = UUID().uuidString, propertyId: String, name: String, type: RoomType = .other, order: Int = 0, createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id; self.propertyId = propertyId; self.name = name; self.type = type; self.order = order
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}

public struct Node: Codable, Identifiable, Sendable, Hashable {
    public var id: String; public var propertyId: String; public var roomId: String; public var label: String
    public var sequence: Int; public var approximatePosition: Position; public var captureMetadata: CaptureMetadata?
    public var status: NodeStatus; public var completedPhotos: Set<PhotoDirection>
    public var createdAt: Date; public var updatedAt: Date
    public init(id: String = UUID().uuidString, propertyId: String, roomId: String, label: String, sequence: Int = 0, approximatePosition: Position = Position(), captureMetadata: CaptureMetadata? = nil, status: NodeStatus = .draft, completedPhotos: Set<PhotoDirection> = [], createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id; self.propertyId = propertyId; self.roomId = roomId; self.label = label; self.sequence = sequence
        self.approximatePosition = approximatePosition; self.captureMetadata = captureMetadata; self.status = status
        self.completedPhotos = completedPhotos; self.createdAt = createdAt; self.updatedAt = updatedAt
    }
    public var isPhotoComplete: Bool { PhotoDirection.required.allSatisfy { completedPhotos.contains($0) } }
    public var photoCompletionProgress: Double { Double(completedPhotos.count) / Double(PhotoDirection.required.count) }
}

public struct Connection: Codable, Identifiable, Sendable, Hashable {
    public var id: String; public var propertyId: String; public var fromNodeId: String; public var toNodeId: String
    public var direction: ConnectionDirection; public var label: String?; public var createdAt: Date; public var updatedAt: Date?
    public init(id: String = UUID().uuidString, propertyId: String, fromNodeId: String, toNodeId: String, direction: ConnectionDirection = .custom, label: String? = nil, createdAt: Date = Date(), updatedAt: Date? = nil) {
        self.id = id; self.propertyId = propertyId; self.fromNodeId = fromNodeId; self.toNodeId = toNodeId
        self.direction = direction; self.label = label; self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}
