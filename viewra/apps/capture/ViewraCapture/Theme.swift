import SwiftUI

enum ViewraTheme {
    static let bg = Color(red: 0.07, green: 0.08, blue: 0.10)
    static let surface = Color(red: 0.12, green: 0.13, blue: 0.16)
    static let surfaceElevated = Color(red: 0.16, green: 0.17, blue: 0.21)
    static let border = Color.white.opacity(0.08)
    static let textPrimary = Color(red: 0.94, green: 0.95, blue: 0.97)
    static let textSecondary = Color(red: 0.62, green: 0.65, blue: 0.70)
    static let accent = Color(red: 0.20, green: 0.78, blue: 0.66)
    static let accentDim = Color(red: 0.12, green: 0.45, blue: 0.38)
    static let warning = Color(red: 0.95, green: 0.72, blue: 0.28)
    static let danger = Color(red: 0.92, green: 0.35, blue: 0.35)
    static let captureReady = Color(red: 0.35, green: 0.78, blue: 0.45)
}

struct OperatorButtonStyle: ButtonStyle {
    var filled: Bool = true
    var destructive: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.body, design: .rounded).weight(.semibold))
            .foregroundStyle(filled ? ViewraTheme.bg : (destructive ? ViewraTheme.danger : ViewraTheme.accent))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(filled ? (destructive ? ViewraTheme.danger : ViewraTheme.accent) : ViewraTheme.surfaceElevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(ViewraTheme.border, lineWidth: filled ? 0 : 1)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
