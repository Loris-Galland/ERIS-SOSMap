import Foundation
import Network

@objc public class CapacitorErisSosmap: NSObject {
    
    private let monitor = NWPathMonitor()
    private var hasInternet = false
    
    public override init() {
        super.init()
        
        // Start monitoring global network connectivity
        monitor.pathUpdateHandler = { path in
            self.hasInternet = path.status == .satisfied
        }
        let queue = DispatchQueue(label: "ErisNetworkMonitor")
        monitor.start(queue: queue)
    }

    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
    
    // Simulate background hardware fallback
    public func processEmergencySignal(latitude: Double, longitude: Double, userId: String, completion: @escaping (Bool, String) -> Void) {
        
        if self.hasInternet {
            // Internet is available
            completion(true, "INTERNET")
        } else {
            // Simulate hardware fallback delay
            print("[ERIS-NATIVE] No internet detected. Initiating Wi-Fi hardware fallback.")
            
            DispatchQueue.global(qos: .background).asyncAfter(deadline: .now() + 4.0) {
                print("[ERIS-NATIVE] Hardware communication successful.")
                completion(true, "WIFI_HARDWARE_FALLBACK")
            }
        }
    }
}