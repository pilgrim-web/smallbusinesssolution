# App Store test deployment

Harbor Time includes an iOS Capacitor shell for a TestFlight pilot. The shell uses bundle identifier `com.pilgrimweb.harbortime`, iOS 15+, build `1`, version `1.0`, and the deployed HTTPS application. The browser/PWA remains supported.

## Prepared in the repository

- Xcode project at `ios/App/App.xcodeproj`
- original 1024px app icon and PWA icon variants
- location usage text that states event-only collection
- non-exempt encryption declaration set to false because the app uses operating-system HTTPS and contains no custom cryptography
- public `/privacy` and `/support` pages
- `npm run ios:sync` and `npm run ios:open` workflows

## Required before TestFlight upload

1. Enroll the publishing organization in the Apple Developer Program.
2. Sign into Xcode with an App Store Connect user authorized for certificates and app management.
3. Register or confirm `com.pilgrimweb.harbortime` and select the correct development team in Signing & Capabilities.
4. Create the App Store Connect app record, privacy answers, age rating, support URL, privacy URL, and reviewer contact.
5. Use a public pilot deployment. A Vercel SSO-protected Preview cannot be the iOS shell URL for external testers.
6. Configure a permanent support email and company/legal privacy details; the repository pages intentionally identify these as incomplete during staging.
7. Archive with Xcode, validate, and upload to App Store Connect. Add internal testers first; external testers require Apple beta review.

Do not embed a Vercel protection-bypass secret in the app bundle. Do not point the pilot build at production payroll data until tenant onboarding, backups, retention, and incident handling are approved.

## Build verification

Run:

```bash
npm run ios:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

An App Store archive requires an Apple distribution signing identity and provisioning profile; simulator success is not evidence of an uploaded TestFlight build.
