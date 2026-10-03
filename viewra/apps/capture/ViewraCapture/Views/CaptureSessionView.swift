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
    @StateObject private var camera = CameraCaptureController()
    @State private var flashMessage: String?
    @State private var isCapturing = false
    @State private var isCreatingNode = false
    @State private var isSavingSkip = false
    /// Hides the "node complete" card while the operator retakes a photo on a finished node.
    @State private var isRetaking = false
    @State private var completionFeedback = 0

    private var session: CaptureSessionState? { appState.sessionState }
    private var completed: Set<PhotoDirection> { session?.currentNodeCompletedPhotos ?? [] }
    private var skipped: Set<PhotoDirection> { session?.currentNodeSkippedDirections ?? [] }
    private var progress: Double { session?.photoCompletionProgress ?? 0 }
    private var isNodeComplete: Bool { session?.isCurrentNodeComplete ?? false }
    private var nodeLabel: String { session?.currentNode?.label ?? "Node" }
    private var showCompletionCard: Bool { isNodeComplete && !isRetaking && !isCreatingNode }

    var body: some View {
        VStack(spacing: 0) {
            header
            cameraPreview
            directionPicker
            skipRow
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
        .onAppear { camera.start(); activeDirection = firstPendingDirection() ?? .left }
        .task { await ensureCurrentNode() }
        .onDisappear { camera.stop() }
        .onChange(of: session?.currentNodeId) { _, _ in
            isRetaking = false
            activeDirection = firstPendingDirection() ?? .left
        }
        .sensoryFeedback(.success, trigger: completionFeedback)
        .sheet(isPresented: $showPostComplete) {
            PostCompleteSheet(
                nodeLabel: nodeLabel,
                onNewNode: { Task { await startNewNode(direction: .forward) } },
                onBranchLeft: { Task { await startBranch(direction: .left) } },
                onBranchRight: { Task { await startBranch(direction: .right) } },
                onReturn: { showPostComplete = false; appState.navigationPath.append(AppRoute.graph(property, room)) },
                onConnectExisting: {
                    showPostComplete = false
                    if let id = appState.graphService?.store.currentNodeId {
                        appState.navigationPath.append(AppRoute.connectExisting(property, room, fromNodeId: id))
                    }
                },
                onFinishRoom: finishRoom
            )
            .presentationDetents([.medium, .large])
        }
        .alert("Quality warning", isPresented: $showWarnings, presenting: validationResult) { result in
            ForEach(result.warnings.filter { $0.canUseAnyway && !$0.usedAnyway }) { issue in
                Button("Use anyway — \(issue.direction?.rawValue ?? "")") {
                    validationResult = CaptureValidator().useAnyway(issueId: issue.id, in: result)
                }
            }
            Button("Continue", role: .cancel) {}
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
                Text(nodeLabel)
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .foregroundStyle(ViewraTheme.textPrimary)
                Spacer()
                Text(isNodeComplete ? "COMPLETE" : "\(completed.union(skipped).count) of \(PhotoDirection.required.count)")
                    .font(.caption.monospaced().weight(.bold))
                    .foregroundStyle(isNodeComplete ? ViewraTheme.captureReady : ViewraTheme.accent)
            }
            ProgressView(value: progress).tint(isNodeComplete ? ViewraTheme.captureReady : ViewraTheme.accent)
            Text("\(property.title) · \(session?.nodes.count ?? 0) node(s) in this room")
                .font(.caption).foregroundStyle(ViewraTheme.textSecondary)
        }
        .padding(.horizontal, 16).padding(.vertical, 12).background(ViewraTheme.surface)
    }

    private var cameraPreview: some View {
        ZStack {
            CameraPreviewView(session: camera.session)
            if showCompletionCard {
                completionCard.transition(.opacity)
            } else {
                VStack {
                    Text(instruction)
                        .font(.footnote.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(ViewraTheme.bg.opacity(0.75), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .padding(12)
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
            if isCreatingNode {
                ProgressView("Creating node…")
                    .padding(16)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.black)
        .animation(.easeInOut(duration: 0.2), value: showCompletionCard)
    }

    private var instruction: String {
        if isRetaking { return "Retaking \(activeDirection.rawValue) on \(nodeLabel). Tap the shutter, or choose another direction." }
        if completed.isEmpty && skipped.isEmpty {
            return "Stand at the spot for \(nodeLabel). Face \(activeDirection.rawValue.lowercased()) and tap the shutter."
        }
        return "Now face \(activeDirection.rawValue.lowercased()). Nothing to photograph there? Tap Skip."
    }

    private var completionCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44)).foregroundStyle(ViewraTheme.captureReady)
            Text("\(nodeLabel) complete")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(ViewraTheme.textPrimary)
            Text("Walk 1–2 m to the next viewpoint, then tap Next Node to photograph it.")
                .font(.subheadline).multilineTextAlignment(.center)
                .foregroundStyle(ViewraTheme.textSecondary)
            Button("Next Node") { Task { await startNewNode(direction: .forward) } }
                .buttonStyle(OperatorButtonStyle())
            HStack(spacing: 10) {
                Button("More options") { showPostComplete = true }
                    .buttonStyle(OperatorButtonStyle(filled: false))
                Button("Finish Room", action: finishRoom)
                    .buttonStyle(OperatorButtonStyle(filled: false, destructive: true))
            }
            Text("Tap a direction below to retake a photo.")
                .font(.caption2).foregroundStyle(ViewraTheme.textSecondary)
        }
        .padding(20)
        .background(ViewraTheme.bg.opacity(0.92), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(16)
    }

    private var directionPicker: some View {
        HStack(spacing: 8) {
            ForEach(PhotoDirection.required, id: \.self) { direction in
                let isDone = completed.contains(direction)
                let isSkipped = skipped.contains(direction)
                Button {
                    activeDirection = direction
                    if isNodeComplete { isRetaking = true }
                } label: {
                    VStack(spacing: 4) {
                        Text(direction.rawValue).font(.caption.weight(.bold).monospaced())
                        Group {
                            if isDone {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(ViewraTheme.captureReady)
                            } else if isSkipped {
                                Image(systemName: "slash.circle").foregroundStyle(ViewraTheme.textSecondary)
                            } else {
                                Image(systemName: "circle").foregroundStyle(ViewraTheme.border)
                            }
                        }
                        .font(.caption)
                        Text(isDone ? "Saved" : isSkipped ? "Skipped" : "Pending")
                            .font(.caption2).foregroundStyle(ViewraTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(activeDirection == direction ? ViewraTheme.surfaceElevated : ViewraTheme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(activeDirection == direction ? ViewraTheme.accent : ViewraTheme.border, lineWidth: 1))
                }
                .foregroundStyle(ViewraTheme.textPrimary)
            }
        }
        .padding(.horizontal, 16).padding(.top, 12)
    }

    @ViewBuilder
    private var skipRow: some View {
        let isSkipped = skipped.contains(activeDirection)
        let isDone = completed.contains(activeDirection)
        HStack {
            if isSkipped {
                Button { Task { await toggleSkip(activeDirection, skip: false) } } label: {
                    Label("Undo skip — photograph \(activeDirection.rawValue)", systemImage: "arrow.uturn.backward")
                }
            } else if !isDone {
                Button { Task { await toggleSkip(activeDirection, skip: true) } } label: {
                    Label("Skip \(activeDirection.rawValue) — nothing to photograph", systemImage: "forward")
                }
            } else {
                Label("\(activeDirection.rawValue) saved — shutter retakes it", systemImage: "checkmark")
                    .foregroundStyle(ViewraTheme.textSecondary)
            }
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(ViewraTheme.accent)
        .disabled(isSavingSkip || isCreatingNode || session?.currentNodeId == nil)
        .frame(maxWidth: .infinity, minHeight: 32)
        .padding(.horizontal, 16).padding(.vertical, 6)
    }

    private var controls: some View {
        let shutterDisabled = isCapturing || isCreatingNode || session?.currentNodeId == nil || showCompletionCard
        return HStack(spacing: 16) {
            Button { cycleDirection(-1) } label: {
                Image(systemName: "chevron.left").frame(width: 48, height: 48)
                    .background(ViewraTheme.surfaceElevated, in: Circle())
            }.foregroundStyle(ViewraTheme.textPrimary)
            Button { Task { await capturePhoto() } } label: {
                ZStack {
                    Circle().stroke(ViewraTheme.accent, lineWidth: 3).frame(width: 76, height: 76)
                    Circle().fill(ViewraTheme.textPrimary).frame(width: 62, height: 62)
                }
            }
            .disabled(shutterDisabled)
            .opacity(shutterDisabled ? 0.4 : 1)
            Button { cycleDirection(1) } label: {
                Image(systemName: "chevron.right").frame(width: 48, height: 48)
                    .background(ViewraTheme.surfaceElevated, in: Circle())
            }.foregroundStyle(ViewraTheme.textPrimary)
        }
        .padding(.vertical, 14).frame(maxWidth: .infinity).background(ViewraTheme.surface)
    }

    private func ensureCurrentNode() async {
        guard let graph = appState.graphService, graph.store.currentNodeId == nil else { return }
        await createNode(direction: .forward, branchFrom: nil)
    }

    private func createNode(direction: ConnectionDirection, branchFrom: String?) async {
        guard !isCreatingNode else { return }
        isCreatingNode = true
        defer { isCreatingNode = false }
        do {
            let node = try await appState.createCaptureNode(property: property, room: room, direction: direction, branchFrom: branchFrom)
            showPostComplete = false
            isRetaking = false
            activeDirection = .left
            flash("\(node.label) started — photograph LEFT, CENTER, RIGHT")
        } catch {
            appState.lastError = error.localizedDescription
            flash("Could not create node: \(error.localizedDescription)")
        }
    }

    private func flash(_ message: String) {
        withAnimation { flashMessage = message }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            if flashMessage == message { withAnimation { flashMessage = nil } }
        }
    }

    private func cycleDirection(_ delta: Int) {
        let all = PhotoDirection.required
        guard let idx = all.firstIndex(of: activeDirection) else { return }
        activeDirection = all[(idx + delta + all.count) % all.count]
    }

    private func firstPendingDirection(after current: PhotoDirection? = nil) -> PhotoDirection? {
        let all = PhotoDirection.required
        let start = current.flatMap { all.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
        return (0..<all.count).map { all[(start + $0) % all.count] }
            .first { !completed.contains($0) && !skipped.contains($0) }
    }

    private func capturePhoto() async {
        guard !isCapturing, let nodeId = session?.currentNodeId else { return }
        isCapturing = true
        defer { isCapturing = false }
        let direction = activeDirection
        let wasComplete = isNodeComplete
        let wasSkipped = skipped.contains(direction)
        do {
            let data = try await camera.captureJPEG()
            guard var current = appState.sessionState, current.currentNodeId == nodeId else { return }
            try appState.uploadQueue.enqueue(nodeId: nodeId, propertyId: property.id, direction: direction, data: data)
            current.markPhotoComplete(direction)
            appState.sessionState = current
            Task { await appState.processUploads() }
            if wasSkipped {
                // markPhotoComplete cleared the skip locally; keep the server in step.
                let remaining = current.currentNodeSkippedDirections.map(\.rawValue).sorted()
                Task { try? await appState.api.updateSkippedDirections(nodeId: nodeId, directions: remaining) }
            }
            flash("\(direction.rawValue) saved")
            afterDirectionResolved(from: direction, wasComplete: wasComplete)
        } catch {
            appState.lastError = error.localizedDescription
            flash(error.localizedDescription)
        }
    }

    private func toggleSkip(_ direction: PhotoDirection, skip: Bool) async {
        guard !isSavingSkip else { return }
        isSavingSkip = true
        defer { isSavingSkip = false }
        let wasComplete = isNodeComplete
        if skip, completed.isEmpty, skipped.union([direction]).count == PhotoDirection.required.count {
            flash("At least one photo is needed at every node")
            return
        }
        if await appState.setSkipped(direction, skipped: skip) {
            flash(skip ? "\(direction.rawValue) skipped" : "\(direction.rawValue) skip removed")
            if skip { afterDirectionResolved(from: direction, wasComplete: wasComplete) }
        } else {
            flash(appState.lastError ?? "Could not update skip")
        }
    }

    private func afterDirectionResolved(from direction: PhotoDirection, wasComplete: Bool) {
        if isNodeComplete {
            isRetaking = false
            if !wasComplete {
                completionFeedback += 1
                finalizeNodeCapture()
            }
        } else if let next = firstPendingDirection(after: direction) {
            activeDirection = next
        }
    }

    private func finalizeNodeCapture() {
        guard let current = appState.sessionState, let nodeId = current.currentNodeId else { return }
        let result = CaptureValidator().validate(
            nodeId: nodeId,
            completedPhotos: current.currentNodeCompletedPhotos,
            skippedDirections: current.currentNodeSkippedDirections,
            qualitySamples: []
        )
        validationResult = result
        if result.warnings.contains(where: { $0.canUseAnyway && !$0.usedAnyway }) { showWarnings = true }
    }

    private func finishRoom() {
        showPostComplete = false
        if !appState.navigationPath.isEmpty { appState.navigationPath.removeLast() }
    }

    private func startNewNode(direction: ConnectionDirection) async {
        await createNode(direction: direction, branchFrom: nil)
    }

    private func startBranch(direction: ConnectionDirection) async {
        guard let originId = appState.graphService?.store.currentNodeId else { return }
        await createNode(direction: direction, branchFrom: originId)
    }
}

struct PostCompleteSheet: View {
    var nodeLabel: String
    var onNewNode: () -> Void
    var onBranchLeft: () -> Void
    var onBranchRight: () -> Void
    var onReturn: () -> Void
    var onConnectExisting: () -> Void
    var onFinishRoom: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Text("\(nodeLabel) complete").font(.system(.title2, design: .rounded).weight(.bold)).foregroundStyle(ViewraTheme.textPrimary)
                Text("Move to the next viewpoint before starting a new node. Use a branch when the path splits (e.g. a doorway to the side).")
                    .font(.subheadline).multilineTextAlignment(.center).foregroundStyle(ViewraTheme.textSecondary)
                Button("New Node (straight ahead)", action: onNewNode).buttonStyle(OperatorButtonStyle())
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
