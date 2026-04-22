import Foundation
import Capacitor

@objc(CapacitorErisSosmapPlugin)
public class CapacitorErisSosmapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorErisSosmapPlugin"
    public let jsName = "CapacitorErisSosmap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "triggerEmergency", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = CapacitorErisSosmap()

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
    
    @objc func triggerEmergency(_ call: CAPPluginCall) {
        let latitude = call.getDouble("latitude") ?? 0.0
        let longitude = call.getDouble("longitude") ?? 0.0
        let userId = call.getString("userId") ?? "unknown_user"
        
        implementation.processEmergencySignal(latitude: latitude, longitude: longitude, userId: userId) { success, method in
            call.resolve([
                "success": success,
                "transmissionMethod": method
            ])
        }
    }
}