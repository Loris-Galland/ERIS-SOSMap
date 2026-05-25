import Foundation
import Capacitor

/*
 * Capacitor plugin bridge for CapacitorErisSosmap.
 * Registers all JS-callable methods and forwards calls to the CapacitorErisSosmap implementation class.
 * Motion data is forwarded to JS via notifyListeners("onMotionData", ...).
 */
@objc(CapacitorErisSosmapPlugin)
public class CapacitorErisSosmapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorErisSosmapPlugin"
    public let jsName = "CapacitorErisSosmap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo",                  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "triggerEmergency",      returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMotionMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMotionMonitoring",  returnType: CAPPluginReturnPromise),
    ]
    private let implementation = CapacitorErisSosmap()

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve(["value": implementation.echo(value)])
    }

    @objc func triggerEmergency(_ call: CAPPluginCall) {
        let latitude  = call.getDouble("latitude")  ?? 0.0
        let longitude = call.getDouble("longitude") ?? 0.0
        let userId    = call.getString("userId")    ?? "unknown_user"

        implementation.processEmergencySignal(
            latitude: latitude, longitude: longitude, userId: userId
        ) { success, method in
            call.resolve(["success": success, "transmissionMethod": method])
        }
    }

    // Begin native motion monitoring and stream samples to JS as onMotionData events
    @objc func startMotionMonitoring(_ call: CAPPluginCall) {
        implementation.startMotionMonitoring { [weak self] sample in
            self?.notifyListeners("onMotionData", data: sample)
        }
        call.resolve()
    }

    // Stop the native motion monitor and free the CoreMotion hardware resource
    @objc func stopMotionMonitoring(_ call: CAPPluginCall) {
        implementation.stopMotionMonitoring()
        call.resolve()
    }
}