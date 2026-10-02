import SwiftUI
import CaptureCore

struct CaptureSessionView: View {
    @EnvironmentObject private var appState: AppState
    let property: APIProperty
    let room: APIRoom

    @State private var activeDirection: PhotoDirection = .left
    @State private var showPostComplete = false
    @State private var validationResult: CaptureValidationResult?
    @State private var showWarnings = false
    @State private var camera = CameraCaptureController()
    @State private var flashMessage: String?

    private var completed: Set<PhotoDirection> { appState.sessionState?.currentNodeCompletedPhotos ?? [] }
    private var progress: Double { appState.sessionState?.photoCompletionProgress ?? 0 }

    var body: some View {
        VStack(spacing: 0) {
            header
            cameraPreview
            directionPicker
            controls
        }
        .background(ViewraTheme.bg.ignoresSafeArea())
        .navigationTitle(room.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { appState.navigationPath.append(AppRoute.graph(property, room)) } label: {
                    Image(systemName: "point.3.connected.trianglepath.dotted")
                }
            }
        }
        .onAppear { ensureCurrentNode(); camera.start() }
        .onDisappear { camera.stop() }
        .sheet(isPresented: $showPostComplete) {
            PostCompleteSheet(
                onNewNode: { startNewNode(direction: .forward) },
                onBranchLeft: { startBranch(direction: .left) },
                onBranchRight: { startBranch(direction: .right) },
                onReturn: { showPostComplete = false; appState.navigationPath.append(AppRoute.graph(property, room)) },
                onConnectExisting: {
                    if let id = appState.graphService?.store.currentNodeId {
                        appState.navigationPath.append(AppRoute.connectExisting(property, room, fromNodeId: id))
                    }
                },
                onFinishRoom: {
                    showPostComplete = false
                    if !appState.navigationPath.isEmpty { appState.navigationPath.removeLast() }
                }
            )
            .presentationDetents([.medium, .large])
        }
        .alert("Quality warning", isPresented: $showWarnings, presenting: validationResult) { result in
            ForEach(result.warnings.filter { $0.canUseAnyway && !$0.usedAnyway }) { issue in
                Button("Use anyway — \(issue.direction?.rawValue ?? "")") {
                    validationResult = CaptureValidator().useAnyway(issueId: issue.id, in: result)
                }
            }
            Button("Continue", role: .cancel) { showPostComplete = true }
        } message: { result in
            Text(result.warnings.map(\.message).joined(separator: "\n"))
        }
        .overlay(alignment: .bottom) {
            if let flashMessage {
                Text(flashMessage).font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 12)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(appState.sessionState?.currentNode?.label ?? "No node")
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .foregroundStyle(ViewraTheme.textPrimary)
                Spacer()
                Text("\(Int(progress * 100))%").font(.caption.monospaced().weight(.bold)).foregroundStyle(ViewraTheme.accent)
            }
            ProgressView(value: progress).tint(ViewraTheme.accent)
            Text(property.title).font(.caption).foregroundStyle(ViewraTheme.textSecondary)
        }
        .padding(.horizontal, 16).padding(.vertical, 12).background(ViewraTheme.surface)
    }

    private var cameraPreview: some View {
        ZStack {
            CameraPreviewView(session: camera.session)
            VStack {
                Spacer()
                HStack {
                    Label(activeDirection.rawValue, systemImage: "camera.aperture")
                        .font(.caption.weight(.bold).monospaced())
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(ViewraTheme.bg.opacity(0.7), in: Capsule())
                    Spacer()
                }.padding(12)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.black)
    }

    private var directionPicker: some View {
        HStack(spacing: 8) {
            ForEach(PhotoDirection.required, id: \.self) { direction in
                let done = completed.contains(direction)
                Button { activeDirection = direction } label: {
                    VStack(spacing: 4) {
                        Text(direction.rawValue).font(.caption.weight(.bold).monospaced())
                        Circle().fill(done ? ViewraTheme.captureReady : ViewraTheme.border).frame(width: 8, height: 8)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(activeDirection == direction ? ViewraTheme.surfaceElevated : ViewraTheme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(activeDirection == direction ? ViewraTheme.accent : ViewraTheme.border, lineWidth: 1))
                }
                .foregroundStyle(ViewraTheme.textPrimary)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
    }

    private var controls: some View {
        HStack(spacing: 16) {
            Button { advanceDirection(-1) } label: {
                Image(systemName: "chevron.left").frame(width: 48, height: 48)
                    .background(ViewraTheme.surfaceElevated, in: Circle())
            }.foregroundStyle(ViewraTheme.textPrimary)
            Button { Task { await capturePhoto() } } label: {
                ZStack {
                    Circle().stroke(ViewraTheme.accent, lineWidth: 3).frame(width: 76, height: 76)
                    Circle().fill(ViewraTheme.textPrimary).frame(width: 62, height: 62)
                }
            }
            Button { advanceDirection(1) } label: {
                Image(systemName: "chevron.right").frame(width: 48, height: 48)
                    .background(ViewraTheme.surfaceElevated, in: Circle())
            }.foregroundStyle(ViewraTheme.textPrimary)
        }
        .padding(.vertical, 18).frame(maxWidth: .infinity).background(ViewraTheme.surface)
    }

    private func ensureCurrentNode() {
        guard let graph = appState.graphService, graph.store.currentNodeId == nil else { return }
        let label = "N\(graph.store.nodes.count + 1)"
        if let node = try? graph.createNode(label: label) {
            appState.sessionState?.currentNodeId = node.id
            appState.sessionState?.nodes = graph.store.nodes
            appState.sessionState?.connections = graph.store.connections
            appState.sessionState?.currentNodeCompletedPhotos = []
        }
    }

    private func advanceDirection(_ delta: Int) {
        let all = PhotoDirection.required
        guard let idx = all.firstIndex(of: activeDirection) else { return }
        activeDirection = all[(idx + delta + all.count) % all.count]
    }

    private func capturePhoto() async {
        do {
            let data = try await camera.captureJPEG()
            guard var session = appState.sessionState, let nodeId = session.currentNodeId else { return }
            _ = try appState.uploadQueue.enqueue(nodeId: nodeId, propertyId: property.id, direction: activeDirection, data: data)
            session.markPhotoComplete(activeDirection)
            appState.sessionState = session
            withAnimation { flashMessage = "\(activeDirection.rawValue) saved" }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { withAnimation { flashMessage = nil } }
            if session.isCurrentNodeComplete { finalizeNodeCapture() } else { advanceDirection(1) }
        } catch {
            appState.lastError = error.localizedDescription
            flashMessage = error.localizedDescription
        }
    }

    private func finalizeNodeCapture() {
        guard let session = appState.sessionState, let nodeId = session.currentNodeId else { return }
        let result = CaptureValidator().validate(nodeId: nodeId, completedPhotos: session.currentNodeCompletedPhotos, qualityStubs: [])
        validationResult = result
        if result.warnings.contains(where: { $0.canUseAnyway && !$0.usedAnyway }) { showWarnings = true }
        else { showPostComplete = true }
    }

    private func startNewNode(direction: ConnectionDirection) {
        guard let graph = appState.graphService else { return }
        if let node = try? graph.createNode(label: "N\(graph.store.nodes.count + 1)", direction: direction) {
            syncSession(nodeId: node.id); showPostComplete = false; activeDirection = .left
        }
    }

    private func startBranch(direction: ConnectionDirection) {
        guard let graph = appState.graphService else { return }
        if let node = try? graph.createBranch(label: "N\(graph.store.nodes.count + 1)", direction: direction) {
            syncSession(nodeId: node.id); showPostComplete = false; activeDirection = .left
        }
    }

    private func syncSession(nodeId: String) {
        guard let graph = appState.graphService else { return }
        appState.sessionState?.currentNodeId = nodeId
        appState.sessionState?.nodes = graph.store.nodes
        appState.sessionState?.connections = graph.store.connections
        appState.sessionState?.currentNodeCompletedPhotos = []
    }
}

struct PostCompleteSheet: View {
    var onNewNode: () -> Void
    var onBranchLeft: () -> Void
    var onBranchRight: () -> Void
    var onReturn: () -> Void
    var onConnectExisting: () -> Void
    var onFinishRoom: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Text("Node complete").font(.system(.title2, design: .rounded).weight(.bold)).foregroundStyle(ViewraTheme.textPrimary)
                Text("Choose the next capture action.").font(.subheadline).foregroundStyle(ViewraTheme.textSecondary)
                Button("New Node", action: onNewNode).buttonStyle(OperatorButtonStyle())
                Button("Branch Left", action: onBranchLeft).buttonStyle(OperatorButtonStyle(filled: false))
                Button("Branch Right", action: onBranchRight).buttonStyle(OperatorButtonStyle(filled: false))
                Button("Return to Node", action: onReturn).buttonStyle(OperatorButtonStyle(filled: false))
                Button("Connect Existing", action: onConnectExisting).buttonStyle(OperatorButtonStyle(filled: false))
                Button("Finish Room", action: onFinishRoom).buttonStyle(OperatorButtonStyle(filled: false, destructive: true))
                Spacer()
            }
            .padding(20).background(ViewraTheme.bg)
        }
    }
}
