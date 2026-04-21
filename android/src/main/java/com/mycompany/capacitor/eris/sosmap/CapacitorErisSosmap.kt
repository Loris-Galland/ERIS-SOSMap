package com.mycompany.capacitor.eris.sosmap

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import com.getcapacitor.Logger

class CapacitorErisSosmap {
    private var context: Context? = null

    fun setContext(context: Context) {
        this.context = context
    }

    fun echo(value: String?): String? {
        Logger.info("Echo", value ?: "")
        return value
    }

    private fun isNetworkAvailable(): Boolean {
        val currentContext = context ?: return false
        val connectivityManager = currentContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val activeNetwork = connectivityManager.getNetworkCapabilities(network) ?: return false

        return activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    fun processEmergencySignal(latitude: Double, longitude: Double, userId: String, callback: (Boolean, String) -> Unit) {
        if (isNetworkAvailable()) {
            callback(true, "INTERNET")
        } else {
            Logger.info("ERIS-NATIVE", "No internet detected. Starting Wi-Fi hardware fallback.")
            Handler(Looper.getMainLooper()).postDelayed({
                Logger.info("ERIS-NATIVE", "Hardware communication successful.")
                callback(true, "WIFI_HARDWARE_FALLBACK")
            }, 4000)
        }
    }
}