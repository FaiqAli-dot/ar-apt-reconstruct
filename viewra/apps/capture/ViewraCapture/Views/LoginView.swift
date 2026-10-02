import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var appState: AppState
    @State private var email = "operator@viewra.local"
    @State private var password = "ViewraOperator123!"
    @FocusState private var focused: Field?
    enum Field { case email, password }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 40)
            VStack(alignment: .leading, spacing: 8) {
                Text("VIEWRA")
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .foregroundStyle(ViewraTheme.accent)
                    .tracking(4)
                Text("Capture Operator")
                    .font(.system(.title3, design: .rounded).weight(.medium))
                    .foregroundStyle(ViewraTheme.textSecondary)
                Text("Sign in to photograph property walkthroughs.")
                    .font(.subheadline)
                    .foregroundStyle(ViewraTheme.textSecondary.opacity(0.85))
                    .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 28)
            Spacer(minLength: 36)
            VStack(spacing: 14) {
                field(title: "Email", text: $email, field: .email, secure: false)
                field(title: "Password", text: $password, field: .password, secure: true)
                if let error = appState.lastError {
                    Text(error).font(.footnote).foregroundStyle(ViewraTheme.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Button {
                    Task { await appState.login(email: email, password: password) }
                } label: {
                    HStack {
                        if appState.isBusy { ProgressView().tint(ViewraTheme.bg) }
                        Text(appState.isBusy ? "Signing in…" : "Sign in")
                    }
                }
                .buttonStyle(OperatorButtonStyle())
                .disabled(appState.isBusy || email.isEmpty || password.isEmpty)
                .padding(.top, 8)
            }
            .padding(28)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(ViewraTheme.surface)
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ViewraTheme.border, lineWidth: 1))
            )
            .padding(.horizontal, 20)
            Spacer()
        }
        .background(
            LinearGradient(colors: [ViewraTheme.bg, ViewraTheme.accentDim.opacity(0.25), ViewraTheme.bg], startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
        )
    }

    private func field(title: String, text: Binding<String>, field: Field, secure: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(ViewraTheme.textSecondary).tracking(1)
            Group {
                if secure { SecureField("", text: text).focused($focused, equals: field) }
                else {
                    TextField("", text: text)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .focused($focused, equals: field)
                }
            }
            .padding(12).background(ViewraTheme.bg)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .foregroundStyle(ViewraTheme.textPrimary)
        }
    }
}
