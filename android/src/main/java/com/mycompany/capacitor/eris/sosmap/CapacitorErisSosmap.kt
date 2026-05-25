/*
 * Core implementation class for the Android side of the CapacitorErisSosmap plugin.
 * Handles network reachability for emergency dispatch and native motion monitoring
 * via Android SensorManager (TYPE_LINEAR_ACCELERATION + TYPE_GYROSCOPE).
 */
package com.mycompany.capacitor.eris.sosmap

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import com.getcapacitor.Logger
import kotlin.math.sqrt

class CapacitorErisSosmap : SensorEventListener {

    private var context: Context? = null
    private var sensorManager: android.hardware.SensorManager? = null
    private var motionCallback: ((Map<String, Any>) -> Unit)? = null

    // Latest gyroscope values — updated on TYPE_GYROSCOPE events, read on accelerometer events
    private var gx = 0f; private var gy = 0f; private var gz = 0f

    fun setContext(ctx: Context) {
        context = ctx
    }

    fun echo(value: String?): String? {
        Logger.info("Echo", value ?: "")
        return value
    }

    // Return true when Wi-Fi or cellular connectivity is available
    private fun isNetworkAvailable(): Boolean {
        val ctx = context ?: return false
        val cm  = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cap = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
        return cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
               cap.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    // Dispatch the emergency signal over internet or simulate a hardware fallback
    fun processEmergencySignal(
        latitude: Double, longitude: Double, userId: String,
        callback: (Boolean, String) -> Unit
    ) {
        if (isNetworkAvailable()) {
            callback(true, "INTERNET")
        } else {
            Logger.info("ERIS-NATIVE", "No internet — starting hardware fallback.")
            Handler(Looper.getMainLooper()).postDelayed({
                Logger.info("ERIS-NATIVE", "Hardware fallback complete.")
                callback(true, "WIFI_HARDWARE_FALLBACK")
            }, 4000)
        }
    }

    // Register accelerometer and gyroscope sensors and start delivering samples at ~5 Hz
    fun startMotionMonitoring(callback: (Map<String, Any>) -> Unit) {
        motionCallback = callback
        val sm = context?.getSystemService(Context.SENSOR_SERVICE)
            as? android.hardware.SensorManager ?: return
        sensorManager = sm

        // 200 000 µs = 5 Hz — adequate for behavioral pattern detection
        val delayUs = 200_000
        sm.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
            ?.let { sm.registerListener(this, it, delayUs) }
        sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
            ?.let { sm.registerListener(this, it, delayUs) }
    }

    // Unregister all sensor listeners and release the callback
    fun stopMotionMonitoring() {
        sensorManager?.unregisterListener(this)
        sensorManager  = null
        motionCallback = null
    }

    // Route sensor events: buffer gyro values, emit combined sample on accelerometer event
    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> {
                gx = event.values[0]; gy = event.values[1]; gz = event.values[2]
            }
            Sensor.TYPE_LINEAR_ACCELERATION -> {
                val ax  = event.values[0].toDouble()
                val ay  = event.values[1].toDouble()
                val az  = event.values[2].toDouble()
                val mag = sqrt(ax * ax + ay * ay + az * az)
                motionCallback?.invoke(mapOf(
                    "ax"        to ax,
                    "ay"        to ay,
                    "az"        to az,
                    "gx"        to gx.toDouble(),
                    "gy"        to gy.toDouble(),
                    "gz"        to gz.toDouble(),
                    "magnitude" to mag,
                    "timestamp" to System.currentTimeMillis().toDouble()
                ))
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) { /* not used */ }
}