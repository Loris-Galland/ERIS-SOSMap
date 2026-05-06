import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch';

export default function PrivacySection() {
  const { t } = useTranslation();

  const [shareLocation, setShareLocation] = useState(true);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(true);

  return (
    <section>
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('settings.privacyTitle', 'Privacy & Safety')}
      </h3>
      <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.shareLocation', 'Share Live Location')}</p>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.shareLocationDesc', 'Allow rescue teams to find you')}
            </p>
          </div>
          <Switch active={shareLocation} onClick={() => setShareLocation(!shareLocation)} />
        </div>
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.analytics', 'Anonymous Analytics')}</p>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.analyticsDesc', 'Help us improve the ERIS network')}
            </p>
          </div>
          <Switch active={anonymousAnalytics} onClick={() => setAnonymousAnalytics(!anonymousAnalytics)} />
        </div>
      </div>
    </section>
  );
}
