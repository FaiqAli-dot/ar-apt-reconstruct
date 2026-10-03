import SwiftUI
import SafariServices

struct SafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

struct PropertiesView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section {
                ForEach(appState.properties) { property in
                    Button { appState.navigationPath.append(AppRoute.rooms(property)) } label: {
                        HStack(spacing: 14) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(ViewraTheme.accent.opacity(0.2))
                                .frame(width: 44, height: 44)
                                .overlay(
                                    Text(String(property.title.prefix(1)).uppercased())
                                        .font(.headline.weight(.bold)).foregroundStyle(ViewraTheme.accent)
                                )
                            VStack(alignment: .leading, spacing: 4) {
                                Text(property.title)
                                    .font(.system(.body, design: .rounded).weight(.semibold))
                                    .foregroundStyle(ViewraTheme.textPrimary)
                                Text(property.status).font(.caption.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(ViewraTheme.textSecondary)
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(ViewraTheme.surface)
                }
            } header: {
                Text("Assigned properties").foregroundStyle(ViewraTheme.textSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(ViewraTheme.bg)
        .navigationTitle("Properties")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Sign out") { appState.logout() }.foregroundStyle(ViewraTheme.textSecondary)
            }
            ToolbarItem(placement: .topBarLeading) {
                Button { Task { await appState.loadProperties() } } label: { Image(systemName: "arrow.clockwise") }
            }
        }
        .task { if appState.properties.isEmpty { await appState.loadProperties() } }
        .overlay {
            if appState.properties.isEmpty && !appState.isBusy {
                ContentUnavailableView("No properties", systemImage: "building.2",
                                       description: Text("Properties assigned to your org will appear here."))
                .foregroundStyle(ViewraTheme.textSecondary)
            }
        }
    }
}

struct RoomsView: View {
    @EnvironmentObject private var appState: AppState
    let property: APIProperty
    @State private var openingRoomId: String?
    @State private var previewURL: URL?
    @State private var isLoadingPreview = false
    @State private var previewError: String?
    private var rooms: [APIRoom] { appState.roomsByProperty[property.id] ?? [] }
    private var hasCaptures: Bool { appState.roomSummaries.values.contains { $0.nodeCount > 0 } }

    var body: some View {
        List {
            Section {
                ForEach(rooms) { room in
                    let summary = appState.roomSummaries[room.id]
                    Button {
                        openingRoomId = room.id
                        Task {
                            await appState.beginCapture(property: property, room: room)
                            openingRoomId = nil
                            appState.navigationPath.append(AppRoute.capture(property, room))
                        }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(room.name).font(.system(.body, design: .rounded).weight(.semibold)).foregroundStyle(ViewraTheme.textPrimary)
                                Text(room.type.replacingOccurrences(of: "_", with: " ")).font(.caption.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                                if let summary, summary.nodeCount > 0 {
                                    Label("\(summary.nodeCount) node\(summary.nodeCount == 1 ? "" : "s") · \(summary.completeCount) complete · \(summary.photoCount) photo\(summary.photoCount == 1 ? "" : "s")",
                                          systemImage: summary.completeCount == summary.nodeCount ? "checkmark.circle.fill" : "circle.dashed")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(summary.completeCount == summary.nodeCount ? ViewraTheme.captureReady : ViewraTheme.warning)
                                }
                            }
                            Spacer()
                            if openingRoomId == room.id {
                                ProgressView()
                            } else {
                                Text((summary?.nodeCount ?? 0) > 0 ? "Continue" : "Capture")
                                    .font(.caption.weight(.bold)).foregroundStyle(ViewraTheme.accent)
                            }
                        }
                        .padding(.vertical, 6)
                    }
                    .disabled(openingRoomId != nil)
                    .listRowBackground(ViewraTheme.surface)
                }
            } header: {
                Text(property.title).foregroundStyle(ViewraTheme.textSecondary)
            }

            if hasCaptures {
                Section {
                    Button { Task { await openPreview() } } label: {
                        HStack {
                            Label("Preview tour", systemImage: "eye")
                                .font(.system(.body, design: .rounded).weight(.semibold))
                            Spacer()
                            if isLoadingPreview { ProgressView() }
                        }
                    }
                    .disabled(isLoadingPreview)
                    .foregroundStyle(ViewraTheme.accent)
                    .listRowBackground(ViewraTheme.surface)
                } footer: {
                    Text(previewError ?? "Opens on your most recent capture. Walk through everything captured so far, exactly as visitors will see it — works before publishing. Retake photos by opening a room and tapping a direction.")
                        .foregroundStyle(previewError == nil ? ViewraTheme.textSecondary : ViewraTheme.danger)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(ViewraTheme.bg)
        .navigationTitle("Rooms")
        .sheet(item: $previewURL) { url in
            SafariView(url: url).ignoresSafeArea()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await openPreview() } } label: { Image(systemName: "eye") }
                    .disabled(isLoadingPreview || !hasCaptures)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    let room = rooms.first ?? APIRoom(id: "", propertyId: property.id, name: "", type: "OTHER", order: 0)
                    appState.navigationPath.append(AppRoute.graph(property, room))
                } label: { Image(systemName: "point.3.connected.trianglepath.dotted") }
                .disabled(rooms.isEmpty)
            }
        }
        .task { await appState.loadRooms(for: property.id) }
        // onAppear (not task) so summaries refresh when returning from a capture session.
        .onAppear { Task { await appState.loadRoomSummaries(propertyId: property.id) } }
        .refreshable {
            await appState.loadRooms(for: property.id)
            await appState.loadRoomSummaries(propertyId: property.id)
        }
    }

    private func openPreview() async {
        isLoadingPreview = true
        defer { isLoadingPreview = false }
        do {
            previewError = nil
            await appState.loadRoomSummaries(propertyId: property.id)
            var url = try await appState.api.createPreviewLink(propertyId: property.id)
            if let nodeId = appState.latestCapturedNodeId {
                url.append(queryItems: [URLQueryItem(name: "node", value: nodeId)])
            }
            previewURL = url
        } catch {
            previewError = "Preview unavailable: \(error.localizedDescription)"
        }
    }
}
