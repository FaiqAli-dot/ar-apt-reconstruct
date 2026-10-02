import SwiftUI
import CaptureCore

@main
struct ViewraCaptureApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack(alignment: .top) {
            Group {
                if appState.isAuthenticated {
                    NavigationStack(path: $appState.navigationPath) {
                        PropertiesView()
                            .navigationDestination(for: AppRoute.self) { route in
                                switch route {
                                case .rooms(let property):
                                    RoomsView(property: property)
                                case .capture(let property, let room):
                                    CaptureSessionView(property: property, room: room)
                                case .graph(let property, let room):
                                    CaptureGraphView(propertyId: property.id, roomId: room.id)
                                case .connectExisting(let property, let room, let fromNodeId):
                                    ConnectExistingNodeView(property: property, room: room, fromNodeId: fromNodeId)
                                }
                            }
                    }
                } else {
                    LoginView()
                }
            }
            if appState.isAuthenticated {
                OfflineQueueBanner().padding(.top, 4)
            }
        }
        .background(ViewraTheme.bg.ignoresSafeArea())
    }
}

enum AppRoute: Hashable {
    case rooms(APIProperty)
    case capture(APIProperty, APIRoom)
    case graph(APIProperty, APIRoom)
    case connectExisting(APIProperty, APIRoom, fromNodeId: String)
}
