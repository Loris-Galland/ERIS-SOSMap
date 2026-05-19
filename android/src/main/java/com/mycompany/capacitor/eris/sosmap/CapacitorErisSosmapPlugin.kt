/*
 * Capacitor plugin bridge for the Android side of CapacitorErisSosmap.
 * Registers all JS-callable @PluginMethods and delegates to CapacitorErisSosmap.
 * Motion samples are forwarded to JS via notifyListeners("onMotionData", ...).
 */
package com.mycompany.capacitor.eris.sosmap

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "CapacitorErisSosmap")
class CapacitorErisSosmapPlugin : Plugin() {

    private val implementation = CapacitorErisSosmap()

    override fun load() {
        implementation.setContext(context)
    }

    @PluginMethod
    fun echo(call: PluginCall) {
        val ret = JSObject()
        ret.put("value", implementation.echo(call.getString("value")))
        call.resolve(ret)
    }

    @PluginMethod
    fun triggerEmergency(call: PluginCall) {
        val latitude  = call.getDouble("latitude",  0.0) ?: 0.0
        val longitude = call.getDouble("longitude", 0.0) ?: 0.0
        val userId    = call.getString("userId", "unknown_user") ?: "unknown_user"

        implementation.processEmergencySignal(latitude, longitude, userId) { success, method ->
            val ret = JSObject()
            ret.put("success", success)
            ret.put("transmissionMethod", method)
            call.resolve(ret)
        }
    }

    // Start the native SensorManager and stream motion samples to JS as onMotionData events
    @PluginMethod
    fun startMotionMonitoring(call: PluginCall) {
        implementation.startMotionMonitoring { sample ->
            val data = JSObject()
            sample.forEach { (k, v) -> data.put(k, v) }
            notifyListeners("onMotionData", data)
        }
        call.resolve()
    }

    // Stop the SensorManager and release sensor registrations
    @PluginMethod
    fun stopMotionMonitoring(call: PluginCall) {
        implementation.stopMotionMonitoring()
        call.resolve()
    }
}