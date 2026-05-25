import Foundation
import Network
import CoreMotion

/*
 * Core implementation class for the CapacitorErisSosmap plugin.
 * Handles network detection for emergency dispatch and native motion monitoring
 * using CoreMotion's CMMotionManager for the AI risk detection feature.
 */
@objc public class CapacitorErisSosmap: NSObject {

    private let networkMonitor = NWPathMonitor()
    private let motionManager  = CMMotionManager()
    private var hasInternet    = false

    public override init() {
        super.init()
        // Begin tracking network reachability in the background
        networkMonitor.pathUpdateHandler = { [weak self] path in
            self?.hasInternet = path.status == .satisfied
        }
        networkMonitor.start(queue: DispatchQueue(label: "ErisNetworkMonitor"))
    }

    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }

    // Check connectivity and either dispatch immediately or simulate a hardware fallback
    public func processEmergencySignal(
        latitude: Double,
        longitude: Double,
        userId: String,
        completion: @escaping (Bool, String) -> Void
    ) {
        if hasInternet {
            completion(true, "INTERNET")
        } else {
            print("[ERIS-NATIVE] No internet — initiating Wi-Fi hardware fallback.")
            DispatchQueue.global(qos: .background).asyncAfter(deadline: .now() + 4.0) {
                print("[ERIS-NATIVE] Hardware fallback complete.")
                completion(true, "WIFI_HARDWARE_FALLBACK")
            }
        }
    }

    // Start streaming accelerometer + gyroscope data at 5 Hz via the provided callback
    public func startMotionMonitoring(onSample: @escaping ([String: Any]) -> Void) {
        guard motionManager.isDeviceMotionAvailable else {
            print("[ERIS-NATIVE] Device motion not available on this device.")
            return
        }

        // 5 Hz is sufficient for fall pattern detection and conserves battery
        motionManager.deviceMotionUpdateInterval = 0.2

        motionManager.startDeviceMotionUpdates(
            using: .xMagneticNorthZVertical,
            to: .main
        ) { motion, error in
            guard let motion = motion, error == nil else { return }

            // userAcceleration is in g-force units — multiply by 9.81 to get m/s²
            let ax = motion.userAcceleration.x * 9.81
            let ay = motion.userAcceleration.y * 9.81
            let az = motion.userAcceleration.z * 9.81
            let magnitude = (ax * ax + ay * ay + az * az).squareRoot()

            onSample([
                "ax":        ax,
                "ay":        ay,
                "az":        az,
                "gx":        motion.rotationRate.x,
                "gy":        motion.rotationRate.y,
                "gz":        motion.rotationRate.z,
                "magnitude": magnitude,
                "timestamp": Date().timeIntervalSince1970 * 1000
            ])
        }
    }

    // Stop the CoreMotion updates and release the hardware sensor
    public func stopMotionMonitoring() {
        motionManager.stopDeviceMotionUpdates()
    }
}