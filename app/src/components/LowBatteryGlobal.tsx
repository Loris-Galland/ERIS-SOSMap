import { useEffect, useState, useRef } from 'react';
import { Device } from '@capacitor/device';
import { Geolocation } from '@capacitor/geolocation';
import { dispatchSOS } from '../services/sosService';
import { supabase } from '../db/supabaseClient';
import { useTranslation } from 'react-i18next';

export default function LowBatteryGlobal() {
  const { t } = useTranslation();

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Refs to prevent spamming the user or the database
  const hasWarnedRef = useRef(false);
  const finalBeaconSentRef = useRef(false);

  // Fetch User ID once for the 1% Auto-SOS
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Global Battery Watcher
  useEffect(() => {
    const checkBattery = async () => {
      try {
        const info = await Device.getBatteryInfo();
        if (typeof info.batteryLevel === 'number') {
          let level = info.batteryLevel;
          if (level <= 1) {
            level = Math.round(level * 100);
          } else {
            level = Math.round(level);
          }
          setBatteryLevel(level);

          // Popup Warning at 20% (Only trigger once per discharge cycle)
          if (level <= 20 && !info.isCharging && !hasWarnedRef.current) {
            hasWarnedRef.current = true;
            setShowModal(true);
          }

          // Reset the warning system if the phone is plugged in or charged above 20%
          if (level > 20 || info.isCharging) {
            hasWarnedRef.current = false;
            finalBeaconSentRef.current = false;
          }

          // Auto-SOS Protocol at 1%
          const isSettingOn = localStorage.getItem('eris_auto_sos_battery') === 'true';
          if (level <= 1 && !info.isCharging && !finalBeaconSentRef.current && isSettingOn && userId) {
            finalBeaconSentRef.current = true;

            // Quickly grab the current position for the final beacon
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 }).catch(
              () => null,
            );
            const rawPos = pos
              ? { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude ?? 0 }
              : { lat: 0, lng: 0, alt: 0 };

            await dispatchSOS(userId, rawPos, level, 'CRITICAL BATTERY: Final auto-beacon.');
          }
        }
      } catch (e) {
        console.warn('[ERIS] Global Battery Check Failed', e);
      }
    };

    checkBattery(); // Check immediately
    const interval = setInterval(checkBattery, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // If the modal is not supposed to show, render nothing (invisible component)
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-eris-bg/90 flex items-center justify-center p-6 backdrop-blur-md">
      <div className="bg-eris-surface border border-eris-alert/50 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <span className="material-symbols-outlined text-eris-alert text-6xl mb-2">battery_alert</span>
          <h3 className="text-eris-text font-bold text-2xl mb-1">{t('lowBattery.low', 'Low Battery')}</h3>
          <p className="text-eris-alert font-bold text-xl mb-4">
            {batteryLevel}% {t('lowBattery.remaining', 'Remaining')}
          </p>

          <div className="bg-eris-alert/10 border border-eris-alert/20 rounded-xl p-4 text-left">
            <p className="text-eris-text-muted text-sm font-medium mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-eris-alert text-sm">tips_and_updates</span>
              {t('lowBattery.extendLife', 'To extend battery life:')}
            </p>
            <ul className="text-eris-text-subtle text-xs space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-eris-text-subtle text-[14px]">battery_saver</span>
                {t('lowBattery.powerSave', "Turn on your phone's Power Saving Mode.")}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-eris-text-subtle text-[14px]">close</span>
                {t('lowBattery.closeBackground', 'Manually close unused background apps.')}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-eris-text-subtle text-[14px]">brightness_low</span>
                {t('lowBattery.lowerBrightness', 'Lower your screen brightness.')}
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => setShowModal(false)}
          className="w-full py-4 bg-eris-surface-alt hover:bg-eris-surface-alt text-eris-text font-bold rounded-2xl active:scale-95 transition-all border border-eris-border"
        >
          {t('lowBattery.dismiss', 'Dismiss')}
        </button>
      </div>
    </div>
  );
}
