import Foundation

public enum ValidationSeverity: String, Codable, Sendable, Hashable {
    case error
    case warning
}

public enum ValidationIssueCode: String, Codable, Sendable, Hashable {
    case missingPhoto = "MISSING_PHOTO"
    case darkImage = "DARK_IMAGE"
    case blurryImage = "BLURRY_IMAGE"
    case incompleteCapture = "INCOMPLETE_CAPTURE"
}

public struct ValidationIssue: Codable, Identifiable, Sendable, Hashable {
    public var id: String
    public var code: ValidationIssueCode
    public var severity: ValidationSeverity
    public var message: String
    public var nodeId: String?
    public var direction: PhotoDirection?
    /// When true, a warning can be overridden by the operator.
    public var canUseAnyway: Bool
    public var usedAnyway: Bool

    public init(
        id: String = UUID().uuidString,
        code: ValidationIssueCode,
        severity: ValidationSeverity,
        message: String,
        nodeId: String? = nil,
        direction: PhotoDirection? = nil,
        canUseAnyway: Bool = false,
        usedAnyway: Bool = false
    ) {
        self.id = id
        self.code = code
        self.severity = severity
        self.message = message
        self.nodeId = nodeId
        self.direction = direction
        self.canUseAnyway = canUseAnyway
        self.usedAnyway = usedAnyway
    }
}

public struct CaptureValidationResult: Codable, Sendable, Hashable {
    public var isComplete: Bool
    public var isAcceptable: Bool
    public var issues: [ValidationIssue]
    public var completedDirections: Set<PhotoDirection>
    public var missingDirections: Set<PhotoDirection>

    public init(
        isComplete: Bool,
        isAcceptable: Bool,
        issues: [ValidationIssue],
        completedDirections: Set<PhotoDirection>,
        missingDirections: Set<PhotoDirection>
    ) {
        self.isComplete = isComplete
        self.isAcceptable = isAcceptable
        self.issues = issues
        self.completedDirections = completedDirections
        self.missingDirections = missingDirections
    }

    public var errors: [ValidationIssue] {
        issues.filter { $0.severity == .error }
    }

    public var warnings: [ValidationIssue] {
        issues.filter { $0.severity == .warning }
    }
}

/// Stub quality signals used for dark/blur warnings (platform fills these in).
public struct PhotoQualityStub: Codable, Sendable, Hashable {
    public var direction: PhotoDirection
    public var isDark: Bool
    public var isBlurry: Bool

    public init(direction: PhotoDirection, isDark: Bool = false, isBlurry: Bool = false) {
        self.direction = direction
        self.isDark = isDark
        self.isBlurry = isBlurry
    }
}

/// Validates required photos and quality stubs for a capture node.
public struct CaptureValidator: Sendable {
    public init() {}

    /// Validates that all required directions are present and applies quality stubs.
    public func validate(
        nodeId: String,
        completedPhotos: Set<PhotoDirection>,
        qualityStubs: [PhotoQualityStub] = [],
        overriddenWarningIds: Set<String> = []
    ) -> CaptureValidationResult {
        var issues: [ValidationIssue] = []
        let required = Set(PhotoDirection.required)
        let missing = required.subtracting(completedPhotos)

        for direction in PhotoDirection.required where missing.contains(direction) {
            issues.append(
                ValidationIssue(
                    code: .missingPhoto,
                    severity: .error,
                    message: "Missing required \(direction.rawValue) photo",
                    nodeId: nodeId,
                    direction: direction,
                    canUseAnyway: false
                )
            )
        }

        if !missing.isEmpty {
            issues.append(
                ValidationIssue(
                    code: .incompleteCapture,
                    severity: .error,
                    message: "Capture is incomplete — \(missing.count) required photo(s) missing",
                    nodeId: nodeId,
                    canUseAnyway: false
                )
            )
        }

        for stub in qualityStubs {
            guard completedPhotos.contains(stub.direction) else { continue }
            if stub.isDark {
                let issue = ValidationIssue(
                    id: "dark-\(nodeId)-\(stub.direction.rawValue)",
                    code: .darkImage,
                    severity: .warning,
                    message: "\(stub.direction.rawValue) photo appears dark",
                    nodeId: nodeId,
                    direction: stub.direction,
                    canUseAnyway: true,
                    usedAnyway: overriddenWarningIds.contains("dark-\(nodeId)-\(stub.direction.rawValue)")
                )
                issues.append(issue)
            }
            if stub.isBlurry {
                let issue = ValidationIssue(
                    id: "blur-\(nodeId)-\(stub.direction.rawValue)",
                    code: .blurryImage,
                    severity: .warning,
                    message: "\(stub.direction.rawValue) photo appears blurry",
                    nodeId: nodeId,
                    direction: stub.direction,
                    canUseAnyway: true,
                    usedAnyway: overriddenWarningIds.contains("blur-\(nodeId)-\(stub.direction.rawValue)")
                )
                issues.append(issue)
            }
        }

        let blockingErrors = issues.filter { $0.severity == .error }
        let isComplete = missing.isEmpty
        let isAcceptable = isComplete && blockingErrors.isEmpty

        return CaptureValidationResult(
            isComplete: isComplete,
            isAcceptable: isAcceptable,
            issues: issues,
            completedDirections: completedPhotos.intersection(required),
            missingDirections: missing
        )
    }

    /// Marks a warning as overridden ("Use anyway").
    public func useAnyway(
        issueId: String,
        in result: CaptureValidationResult
    ) -> CaptureValidationResult {
        var issues = result.issues
        if let idx = issues.firstIndex(where: { $0.id == issueId }) {
            guard issues[idx].canUseAnyway else { return result }
            issues[idx].usedAnyway = true
        }
        return CaptureValidationResult(
            isComplete: result.isComplete,
            isAcceptable: result.isAcceptable,
            issues: issues,
            completedDirections: result.completedDirections,
            missingDirections: result.missingDirections
        )
    }
}
