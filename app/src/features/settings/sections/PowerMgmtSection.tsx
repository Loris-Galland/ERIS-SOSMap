/**
 * PowerMgmtSection.tsx
 *
 * Manages power-related safety features, specifically the Auto-SOS trigger
 * when the device reaches critical battery levels.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch';

export default function PowerMgmtSection() {
  const { t } = useTranslation();
  // Initiates state based on local storage to persist the user's choice
  const [autoSosBattery, setAutoSosBattery] = useState(localStorage.getItem('eris_auto_sos_battery') === 'true');

  /**
   * Toggles the Auto-SOS battery feature and saves it to localStorage
   */
  const handleToggle = () => {
    const newValue = !autoSosBattery;
    setAutoSosBattery(newValue);
    localStorage.setItem('eris_auto_sos_battery', String(newValue));
  };

  return (
    <section>
      <h3 className="text-eris-text-subtle text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('settings.powerMgmtTitle', 'Power Management')}
      </h3>

      <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-4">
          {/* Text and Icon block */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="material-symbols-outlined text-eris-alert text-sm">battery_alert</span>
              <p className="text-eris-text text-sm font-medium">
                {t('settings.autoSosBattery', 'Auto-SOS (Critical Battery)')}
              </p>
            </div>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.autoSosBatteryDesc', 'Send last position automatically at 1% battery')}
            </p>
          </div>

          {/* Reusable Switch component */}
          <Switch active={autoSosBattery} onClick={handleToggle} />
        </div>
      </div>
    </section>
  );
}
