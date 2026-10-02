import SwiftUI
import AVFoundation
import UIKit

@MainActor
final class CameraCaptureController: NSObject, ObservableObject {
    let session = AVCaptureSession()
    private let output = AVCapturePhotoOutput()
    private var continuation: CheckedContinuation<Data, Error>?
    private let queue = DispatchQueue(label: "com.viewra.capture.camera")

    enum CameraError: LocalizedError {
        case unavailable, captureFailed
        var errorDescription: String? {
            switch self {
            case .unavailable: return "Camera unavailable"
            case .captureFailed: return "Capture failed"
            }
        }
    }

    func start() {
        queue.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            self.session.sessionPreset = .photo
            if self.session.inputs.isEmpty {
                guard
                    let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                    let input = try? AVCaptureDeviceInput(device: device),
                    self.session.canAddInput(input)
                else { self.session.commitConfiguration(); return }
                self.session.addInput(input)
            }
            if self.session.outputs.isEmpty, self.session.canAddOutput(self.output) {
                self.session.addOutput(self.output)
            }
            self.session.commitConfiguration()
            if !self.session.isRunning { self.session.startRunning() }
        }
    }

    func stop() { queue.async { [weak self] in self?.session.stopRunning() } }

    func captureJPEG() async throws -> Data {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Data, Error>) in
            self.continuation = cont
            self.output.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
        }
    }
}

extension CameraCaptureController: AVCapturePhotoCaptureDelegate {
    nonisolated func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        Task { @MainActor in
            if let error { continuation?.resume(throwing: error); continuation = nil; return }
            guard let data = photo.fileDataRepresentation() else {
                continuation?.resume(throwing: CameraError.captureFailed); continuation = nil; return
            }
            continuation?.resume(returning: data); continuation = nil
        }
    }
}

struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession
    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.videoPreviewLayer.session = session
        view.videoPreviewLayer.videoGravity = .resizeAspectFill
        return view
    }
    func updateUIView(_ uiView: PreviewView, context: Context) {
        uiView.videoPreviewLayer.session = session
    }
    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var videoPreviewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}
