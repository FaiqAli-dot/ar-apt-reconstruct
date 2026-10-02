# Viewra Capture (iOS)

SwiftUI operator app for photographing property walkthroughs (LEFT / CENTER / RIGHT) and building the navigation graph.

## Requirements

- macOS with Xcode 15+ (iOS 17 SDK)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Local or remote Viewra API (default `http://localhost:3001`)

## Open in Xcode

```bash
cd apps/capture
xcodegen generate
open ViewraCapture.xcodeproj
```

XcodeGen resolves the local Swift package at `../../packages/CaptureCore`.

Select an iOS 17+ Simulator or device, then Run (⌘R). On a physical device, set your Development Team in Signing & Capabilities.

## CaptureCore package

Platform-independent logic lives in `packages/CaptureCore` (no UIKit / AVFoundation):

```bash
cd packages/CaptureCore
swift test
```

## Operator flow

1. **Login** — `POST /api/auth/login` (seed: `operator@viewra.local` / `ViewraOperator123!`)
2. **Properties** → **Rooms** → start **Capture Session**
3. Capture **LEFT / CENTER / RIGHT** via AVFoundation camera
4. After a node is complete: **New Node**, **Branch**, **Return**, **Connect Existing**, or **Finish Room**
5. **Graph** view for return-to-node; **Connect Existing** lists nodes grouped by room
6. **Offline queue banner** shows pending/retrying photo uploads (presigned PUT)

## Configuration

Default API base URL is `http://localhost:3001` in `APIClient.defaultBaseURL`. Camera usage is declared in `Info.plist` (`NSCameraUsageDescription`).
