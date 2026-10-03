import SwiftUI
import CaptureCore

struct CaptureGraphView: View {
    @EnvironmentObject private var appState: AppState
    let propertyId: String
    let roomId: String

    private var nodes: [Node] { appState.graphService?.store.nodes ?? [] }
    private var connections: [Connection] { appState.graphService?.store.connections ?? [] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Capture graph")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .foregroundStyle(ViewraTheme.textPrimary)
                Text("\(nodes.count) nodes · \(connections.count) connections")
                    .font(.caption.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                GraphCanvas(nodes: nodes, connections: connections, currentId: appState.graphService?.store.currentNodeId)
                    .frame(height: 280)
                    .background(ViewraTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                ForEach(nodes) { node in
                    Button {
                        _ = try? appState.graphService?.returnToNode(id: node.id)
                        appState.sessionState?.currentNodeId = node.id
                        // Photo progress is tracked on the session copy, not the graph store.
                        appState.sessionState?.currentNodeCompletedPhotos =
                            appState.sessionState?.nodes.first(where: { $0.id == node.id })?.completedPhotos ?? []
                        if !appState.navigationPath.isEmpty { appState.navigationPath.removeLast() }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(node.label).font(.system(.body, design: .rounded).weight(.semibold))
                                Text(node.id.prefix(8)).font(.caption2.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                            }
                            Spacer()
                            if appState.graphService?.store.currentNodeId == node.id {
                                Text("CURRENT").font(.caption2.weight(.bold).monospaced()).foregroundStyle(ViewraTheme.accent)
                            } else {
                                Text("Return").font(.caption.weight(.semibold)).foregroundStyle(ViewraTheme.accent)
                            }
                        }
                        .padding(12)
                        .background(ViewraTheme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .foregroundStyle(ViewraTheme.textPrimary)
                }
            }
            .padding(16)
        }
        .background(ViewraTheme.bg)
        .navigationTitle("Graph")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct GraphCanvas: View {
    let nodes: [Node]
    let connections: [Connection]
    let currentId: String?

    var body: some View {
        GeometryReader { geo in
            let positions = layout(in: geo.size)
            ZStack {
                ForEach(connections) { connection in
                    if let from = positions[connection.fromNodeId], let to = positions[connection.toNodeId] {
                        Path { path in path.move(to: from); path.addLine(to: to) }
                            .stroke(ViewraTheme.accent.opacity(0.45), lineWidth: 2)
                    }
                }
                ForEach(nodes) { node in
                    if let point = positions[node.id] {
                        Circle()
                            .fill(node.id == currentId ? ViewraTheme.accent : ViewraTheme.surfaceElevated)
                            .frame(width: 28, height: 28)
                            .overlay(
                                Text(node.label).font(.system(size: 9, weight: .bold, design: .rounded))
                                    .foregroundStyle(node.id == currentId ? ViewraTheme.bg : ViewraTheme.textPrimary)
                            )
                            .position(point)
                    }
                }
            }
        }
        .padding(12)
    }

    private func layout(in size: CGSize) -> [String: CGPoint] {
        guard !nodes.isEmpty else { return [:] }
        let cols = max(1, Int(ceil(sqrt(Double(nodes.count)))))
        var map: [String: CGPoint] = [:]
        for (index, node) in nodes.enumerated() {
            let col = index % cols
            let row = index / cols
            let rows = max(1, Int(ceil(Double(nodes.count) / Double(cols))))
            map[node.id] = CGPoint(
                x: size.width * (CGFloat(col) + 0.5) / CGFloat(cols),
                y: size.height * (CGFloat(row) + 0.5) / CGFloat(rows)
            )
        }
        return map
    }
}

struct ConnectExistingNodeView: View {
    @EnvironmentObject private var appState: AppState
    let property: APIProperty
    let room: APIRoom
    let fromNodeId: String

    @State private var allRooms: [APIRoom] = []
    @State private var remoteNodes: [APINode] = []
    @State private var isConnecting = false
    @State private var errorMessage: String?

    private var localNodes: [Node] {
        appState.graphService?.store.nodes.filter { $0.id != fromNodeId } ?? []
    }

    var body: some View {
        List {
            if let errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(ViewraTheme.danger)
                    .listRowBackground(ViewraTheme.surface)
            }
            Section("Current room — \(room.name)") {
                ForEach(localNodes) { node in
                    Button { connect(to: node.id) } label: {
                        HStack {
                            Text(node.label).foregroundStyle(ViewraTheme.textPrimary)
                            Spacer()
                            Text(node.status.rawValue).font(.caption.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                        }
                    }
                    .listRowBackground(ViewraTheme.surface)
                }
            }
            if !remoteNodes.isEmpty {
                let localIds = Set(localNodes.map(\.id))
                let byRoom = Dictionary(grouping: remoteNodes.filter { $0.id != fromNodeId && !localIds.contains($0.id) }) { $0.roomId }
                ForEach(allRooms, id: \.id) { rm in
                    if let nodes = byRoom[rm.id], !nodes.isEmpty {
                        Section(rm.name) {
                            ForEach(nodes) { node in
                                Button { connect(to: node.id) } label: {
                                    HStack {
                                        Text(node.label).foregroundStyle(ViewraTheme.textPrimary)
                                        Spacer()
                                        Text(node.status).font(.caption.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                                    }
                                }
                                .listRowBackground(ViewraTheme.surface)
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(ViewraTheme.bg)
        .navigationTitle("Connect existing")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadRemote() }
    }

    private func loadRemote() async {
        do {
            allRooms = try await appState.api.listRooms(propertyId: property.id)
            remoteNodes = try await appState.api.listNodes(propertyId: property.id)
        } catch {
            appState.lastError = error.localizedDescription
        }
    }

    private func connect(to toNodeId: String) {
        guard !isConnecting else { return }
        isConnecting = true
        Task {
            defer { isConnecting = false }
            do {
                _ = try await appState.api.createConnection(
                    propertyId: property.id, fromNodeId: fromNodeId, toNodeId: toNodeId, direction: ConnectionDirection.custom.rawValue
                )
                if appState.graphService?.store.containsNode(id: toNodeId) == true {
                    _ = try? appState.graphService?.connectExistingNode(to: toNodeId, from: fromNodeId, direction: .custom)
                    appState.sessionState?.connections = appState.graphService?.store.connections ?? []
                }
                if !appState.navigationPath.isEmpty { appState.navigationPath.removeLast() }
            } catch {
                errorMessage = error.localizedDescription
                appState.lastError = error.localizedDescription
            }
        }
    }
}

struct OfflineQueueBanner: View {
    @EnvironmentObject private var appState: AppState

    private var pending: Int { appState.uploadQueue.pendingCount }
    private var failed: Int { appState.uploadQueue.failedCount }
    private var progress: Double { appState.uploadQueue.progress }

    var body: some View {
        if pending > 0 || failed > 0 {
            HStack(spacing: 10) {
                Image(systemName: failed > 0 ? "exclamationmark.triangle.fill" : "arrow.up.circle.fill")
                    .foregroundStyle(failed > 0 ? ViewraTheme.warning : ViewraTheme.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(failed > 0 ? "\(failed) upload(s) retrying" : "\(pending) pending upload(s)")
                        .font(.caption.weight(.semibold)).foregroundStyle(ViewraTheme.textPrimary)
                    ProgressView(value: progress).tint(ViewraTheme.accent)
                }
                Button("Retry") {
                    Task { await appState.retryUploads() }
                }
                .font(.caption.weight(.bold)).foregroundStyle(ViewraTheme.accent)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 12)
        }
    }
}
