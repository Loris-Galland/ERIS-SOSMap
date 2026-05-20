import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch'; // Adjust import path based on your folder structure

export default function SosSection() {
  const { t } = useTranslation();

  // Load initial toggle state (defaults to true if not explicitly set to false in localStorage)
  const [isShakeEnabled, setIsShakeEnabled] = useState<boolean>(
    localStorage.getItem('eris_shake_sos_enabled') === 'true',
  );

  // Load initial state for Discrete SOS Method
  type DiscreteMethod = 'none' | 'quad_tap' | 'device_flip';
  const [discreteMethod, setDiscreteMethod] = useState<DiscreteMethod>(
    (localStorage.getItem('eris_discrete_sos_method') as DiscreteMethod) || 'none',
  );

  const handleToggleChange = () => {
    const nextState = !isShakeEnabled;
    setIsShakeEnabled(nextState);
    localStorage.setItem('eris_shake_sos_enabled', String(nextState));
    console.log(`[SETTINGS] Shake-to-SOS updated to: ${nextState}`);

    window.dispatchEvent(new CustomEvent('eris-shake-preference-changed'));
  };

  const handleDiscreteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMethod = e.target.value as DiscreteMethod;
    setDiscreteMethod(nextMethod);
    localStorage.setItem('eris_discrete_sos_method', nextMethod);
    console.log(`[SETTINGS] Discrete SOS updated to: ${nextMethod}`);

    // Dispatch an event so the Discrete hook instantly picks up the change without restarting the app
    window.dispatchEvent(new CustomEvent('eris-discrete-preference-changed'));
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

        {/* Discrete (Silent) SOS Entry Row Item */}
        <div className="flex items-center justify-between p-4">
          <div className="flex-1 pr-4">
            <p className="text-eris-text text-sm font-medium">{t('settings.discrete_sos_title', 'Discrete SOS')}</p>
            <p className="text-eris-text-subtle text-[11px] leading-normal">
              {t('settings.discrete_sos_desc', 'Trigger a silent SOS without sirens or alarms')}
            </p>
          </div>

          {/* Themed Dropdown Menu with adaptive icon */}
          <div className="relative">
            <select
              value={discreteMethod}
              onChange={handleDiscreteChange}
              className="appearance-none bg-eris-surface/80 [.theme-contrasted_&]:bg-black border border-eris-border/50 [.theme-contrasted_&]:border-white text-eris-text text-xs rounded-xl pl-3 pr-8 py-2 outline-none focus:border-eris-primary transition-colors cursor-pointer font-medium shadow-sm"
            >
              <option value="none">{t('settings.discrete_none', 'Disabled')}</option>
              <option value="quad_tap">{t('settings.discrete_tap', '4 Rapid Taps')}</option>
              <option value="device_flip">{t('settings.discrete_flip', '3 Phone Flips')}</option>
            </select>
            {/* The chevron automatically takes the theme's subtle text color */}
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-eris-text-muted [.theme-contrasted_&]:text-white pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
