import SwiftUI

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
    private var rooms: [APIRoom] { appState.roomsByProperty[property.id] ?? [] }

    var body: some View {
        List {
            Section {
                ForEach(rooms) { room in
                    Button {
                        appState.beginCapture(property: property, room: room)
                        appState.navigationPath.append(AppRoute.capture(property, room))
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(room.name).font(.system(.body, design: .rounded).weight(.semibold)).foregroundStyle(ViewraTheme.textPrimary)
                                Text(room.type.replacingOccurrences(of: "_", with: " ")).font(.caption.monospaced()).foregroundStyle(ViewraTheme.textSecondary)
                            }
                            Spacer()
                            Text("Capture").font(.caption.weight(.bold)).foregroundStyle(ViewraTheme.accent)
                        }
                        .padding(.vertical, 6)
                    }
                    .listRowBackground(ViewraTheme.surface)
                }
            } header: {
                Text(property.title).foregroundStyle(ViewraTheme.textSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(ViewraTheme.bg)
        .navigationTitle("Rooms")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    let room = rooms.first ?? APIRoom(id: "", propertyId: property.id, name: "", type: "OTHER", order: 0)
                    appState.navigationPath.append(AppRoute.graph(property, room))
                } label: { Image(systemName: "point.3.connected.trianglepath.dotted") }
                .disabled(rooms.isEmpty)
            }
        }
        .task { await appState.loadRooms(for: property.id) }
    }
}
