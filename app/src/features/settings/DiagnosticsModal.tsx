/*
 * Full-screen overlay modal that shows real-time device diagnostics: network status,
 * mesh relay, GPS signal, and battery level. Exports the default DiagnosticsModal component,
 * opened from DiagnosticsSection inside the settings screen.
 * Uses @capacitor/network and @capacitor/device for live system data.
 */
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
    <div className="absolute inset-0 z-[6000] bg-eris-bg/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-eris-surface border border-eris-border/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-eris-text text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-eris-primary">query_stats</span>
            {t('diagnostics.title', 'System Diagnostics')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-eris-surface-alt rounded-full text-eris-text-muted hover:text-eris-text active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* INTERNET STATUS */}
          <div className="flex items-center justify-between bg-eris-surface-alt/40 p-4 rounded-2xl border border-eris-border/50">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-2xl ${networkInfo.connected ? 'text-eris-success' : 'text-eris-danger [.theme-contrasted_&]:!text-gray-500'}`}
              >
                {networkInfo.type === 'wifi'
                  ? 'wifi'
                  : networkInfo.connected
                    ? 'signal_cellular_4_bar'
                    : 'signal_disconnected'}
              </span>
              <div>
                <div className="text-eris-text text-sm font-bold">{t('diagnostics.internet', 'Internet (Cloud)')}</div>
                <div className="text-eris-text-muted text-xs">
                  {networkInfo.connected
                    ? t('diagnostics.connect', 'Connected via ${network}').replace(
                        '${network}',
                        networkInfo.type.toUpperCase(),
                      )
                    : t('diagnostics.offline', 'Offline')}
                </div>
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${networkInfo.connected ? 'bg-eris-success shadow-[0_0_10px_rgba(--var(--eris-success),0.5)]' : 'bg-eris-danger shadow-[0_0_10px_rgba(var(--eris-danger),0.5)] [.theme-contrasted_&]:!bg-gray-500'}`}
            />
          </div>

          {/* MESH NETWORK STATUS */}
          <div className="flex items-center justify-between bg-eris-surface-alt/40 p-4 rounded-2xl border border-eris-border/50">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-eris-primary">bluetooth_drive</span>
              <div>
                <div className="text-eris-text text-sm font-bold">{t('diagnostics.mesh', 'Local Mesh Relay')}</div>
                <div className="text-eris-text-muted text-xs">
                  {t('diagnostics.node', 'Listening for nearby ERIS nodes')}
                </div>
              </div>
            </div>
            <div className="w-3 h-3 rounded-full bg-eris-primary shadow-[0_0_10px_rgba(car(--eris-primary),0.5)] [.theme-contrasted_&]:shadow-none animate-pulse" />
          </div>

          {/* GPS STATUS */}
          <div className="flex items-center justify-between bg-eris-surface-alt/40 p-4 rounded-2xl border border-eris-border/50">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-2xl ${gpsStatus === 'Connected' ? 'text-eris-success' : 'text-eris-alert [.theme-contrasted_&]:!text-gray-500'}`}
              >
                my_location
              </span>
              <div>
                <div className="text-eris-text text-sm font-bold">{t('diagnostics.gps', 'GPS Hardware')}</div>
                <div className="text-eris-text-muted text-xs">{gpsStatus}</div>
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${gpsStatus === 'Connected' ? 'bg-eris-success' : 'bg-eris-alert animate-pulse [.theme-contrasted_&]:!bg-gray-500'}`}
            />
          </div>

          {/* BATTERY STATUS */}
          <div className="flex items-center justify-between bg-eris-surface-alt/40 p-4 rounded-2xl border border-eris-border/50">
            <div className="flex items-center gap-3">
              <span
                className={`material-symbols-outlined text-2xl ${batteryInfo.level > 20 ? 'text-eris-success' : 'text-eris-danger [.theme-contrasted_&]:!text-gray-500'}`}
              >
                {batteryInfo.isCharging ? 'battery_charging_full' : 'battery_full'}
              </span>
              <div>
                <div className="text-eris-text text-sm font-bold">{t('diagnostics.power', 'Power')}</div>
                <div className="text-eris-text-muted text-xs">
                  {batteryInfo.level}% {batteryInfo.isCharging ? t('diagnostics.charging', '(Charging)') : ''}
                </div>
              </div>
            </div>
            <div className="text-eris-text text-sm font-mono font-bold">{batteryInfo.level}%</div>
          </div>
        </div>

        <p className="text-eris-text-muted text-xs text-center mt-6">
          {networkInfo.connected
            ? t('diagnostics.sosCloud', 'Your SOS will be dispatched globally to the ERIS Cloud.')
            : t('diagnostics.sosMesh', 'No internet. Your SOS will rely on Local Mesh and SMS Fallback.')}
        </p>
      </div>
    </div>
  );
}
