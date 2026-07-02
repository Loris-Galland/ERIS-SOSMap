const fs = require('fs');
const path = require('path');

const voiceRecorderDir = path.join(__dirname, '../node_modules/capacitor-voice-recorder');
const pluginDir = path.join(voiceRecorderDir, 'ios/Plugin');
const pkgSwiftPath = path.join(voiceRecorderDir, 'Package.swift');

// 1. Add Package.swift for SPM
const pkgSwiftContent = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorVoiceRecorder",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorVoiceRecorder",
            targets: ["VoiceRecorderPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "VoiceRecorderPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin")
    ]
)
`;

if (fs.existsSync(voiceRecorderDir)) {
  try {
    if (!fs.existsSync(pkgSwiftPath)) {
      fs.writeFileSync(pkgSwiftPath, pkgSwiftContent, 'utf8');
      console.log('[patch-plugins] Added Package.swift to capacitor-voice-recorder');
    }

    // 2. Remove Objective-C files (.h and .m) which cause mixed-language errors in SPM
    const headerPath = path.join(pluginDir, 'VoiceRecorder.h');
    const objcPath = path.join(pluginDir, 'VoiceRecorder.m');
    if (fs.existsSync(headerPath)) {
      fs.unlinkSync(headerPath);
      console.log('[patch-plugins] Removed VoiceRecorder.h');
    }
    if (fs.existsSync(objcPath)) {
      fs.unlinkSync(objcPath);
      console.log('[patch-plugins] Removed VoiceRecorder.m');
    }

    // 3. Patch VoiceRecorder.swift to implement CAPBridgedPlugin
    const swiftPath = path.join(pluginDir, 'VoiceRecorder.swift');
    if (fs.existsSync(swiftPath)) {
      let swiftContent = fs.readFileSync(swiftPath, 'utf8');
      if (!swiftContent.includes('CAPBridgedPlugin')) {
        swiftContent = swiftContent.replace(
          'public class VoiceRecorder: CAPPlugin {',
          `public class VoiceRecorder: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VoiceRecorder"
    public let jsName = "VoiceRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canDeviceVoiceRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAudioRecordingPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasAudioRecordingPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise)
    ]`
        );
        fs.writeFileSync(swiftPath, swiftContent, 'utf8');
        console.log('[patch-plugins] Patched VoiceRecorder.swift for CAPBridgedPlugin');
      }
    }
  } catch (err) {
    console.error('[patch-plugins] Error patching capacitor-voice-recorder:', err);
  }
}
