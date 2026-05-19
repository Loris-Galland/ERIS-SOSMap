import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch'; // Adjust import path based on your folder structure

export default function SensorsSection() {
  const { t } = useTranslation();

  // Load initial toggle state (defaults to true if not explicitly set to false in localStorage)
  const [isShakeEnabled, setIsShakeEnabled] = useState<boolean>(
    localStorage.getItem('eris_shake_sos_enabled') === 'true',
  );

  const handleToggleChange = () => {
    const nextState = !isShakeEnabled;
    setIsShakeEnabled(nextState);
    localStorage.setItem('eris_shake_sos_enabled', String(nextState));
    console.log(`[SETTINGS] Shake-to-SOS updated to: ${nextState}`);

    window.dispatchEvent(new CustomEvent('eris-shake-preference-changed'));
  };

  return (
    <section>
      {/* Sensors Section Title Header matching the custom typography pattern */}
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('settings.sensorsTitle', 'Device Sensors')}
      </h3>

      {/* Surface block with exact background opacity variations and card rounding bounds */}
      <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
        {/* Shake to SOS Entry Row Item */}
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.shake_sos_title', 'Shake to SOS')}</p>
            <p className="text-eris-text-subtle text-[11px] leading-normal">
              {t('settings.shake_sos_desc', 'Sends automatically an SOS when shaking the device')}
            </p>
          </div>

          {/* Synchronized workspace switch binding element configuration */}
          <Switch active={isShakeEnabled} onClick={handleToggleChange} />
        </div>
      </div>
    </section>
  );
}
