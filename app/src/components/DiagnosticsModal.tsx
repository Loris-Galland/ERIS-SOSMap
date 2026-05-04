import React, { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { useTranslation } from 'react-i18next';

interface DiagnosticsModalProps {
  onClose: () => void;
  gpsStatus: string;
}

export default function DiagnosticsModal({ onClose, gpsStatus }: DiagnosticsModalProps) {
  const { t } = useTranslation();

  const [networkInfo, setNetworkInfo] = useState({ connected: false, type: 'unknown' });
  const [batteryInfo, setBatteryInfo] = useState({ level: 100, isCharging: false });

  useEffect(() => {
    // Check Internet status
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setNetworkInfo({ connected: status.connected, type: status.connectionType });
    };

    // Check Battery status
    const checkBattery = async () => {
      const info = await Device.getBatteryInfo();
      // Capacitor returns battery level between 0.0 and 1.0
      setBatteryInfo({
        level: Math.round((info.batteryLevel || 1) * 100),
        isCharging: info.isCharging || false,
      });
    };

    checkNetwork();
    checkBattery();

    // Listen for real-time network changes
    const networkListener = Network.addListener('networkStatusChange', (status) => {
      setNetworkInfo({ connected: status.connected, type: status.connectionType });
    });

    return () => {
      networkListener.then((listener) => listener.remove());
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[6000] bg-[#0f141e]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">query_stats</span>
            {t('diagnostics.title', 'System Diagnostics')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* INTERNET STATUS */}
          <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-2xl ${networkInfo.connected ? 'text-green-400' : 'text-red-400'}`}
              >
                {networkInfo.type === 'wifi'
                  ? 'wifi'
                  : networkInfo.connected
                    ? 'signal_cellular_4_bar'
                    : 'signal_disconnected'}
              </span>
              <div>
                <div className="text-white text-sm font-bold">Internet (Cloud)</div>
                <div className="text-gray-400 text-xs">
                  {networkInfo.connected ? `Connected via ${networkInfo.type.toUpperCase()}` : 'Offline'}
                </div>
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${networkInfo.connected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
            />
          </div>

          {/* MESH NETWORK STATUS */}
          <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-blue-400">bluetooth_drive</span>
              <div>
                <div className="text-white text-sm font-bold">Local Mesh Relay</div>
                <div className="text-gray-400 text-xs">Listening for nearby ERIS nodes</div>
              </div>
            </div>
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
          </div>

          {/* GPS STATUS */}
          <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-2xl ${gpsStatus === 'Connected' ? 'text-green-400' : 'text-yellow-400'}`}
              >
                my_location
              </span>
              <div>
                <div className="text-white text-sm font-bold">GPS Hardware</div>
                <div className="text-gray-400 text-xs">{gpsStatus}</div>
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${gpsStatus === 'Connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}
            />
          </div>

          {/* BATTERY STATUS */}
          <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-2xl ${batteryInfo.level > 20 ? 'text-green-400' : 'text-red-400'}`}
              >
                {batteryInfo.isCharging ? 'battery_charging_full' : 'battery_full'}
              </span>
              <div>
                <div className="text-white text-sm font-bold">Power</div>
                <div className="text-gray-400 text-xs">
                  {batteryInfo.level}% {batteryInfo.isCharging ? '(Charging)' : ''}
                </div>
              </div>
            </div>
            <div className="text-white text-sm font-mono font-bold">{batteryInfo.level}%</div>
          </div>
        </div>

        <p className="text-gray-500 text-xs text-center mt-6">
          {networkInfo.connected
            ? 'Your SOS will be dispatched globally to the ERIS Cloud.'
            : 'No internet. Your SOS will rely on Local Mesh and SMS Fallback.'}
        </p>
      </div>
    </div>
  );
}
