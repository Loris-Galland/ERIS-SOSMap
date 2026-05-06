import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch';

export default function NotificationsSection() {
  const { t } = useTranslation();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [criticalAlertsOnly, setCriticalAlertsOnly] = useState(false);

  return (
    <section>
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('settings.notificationsTitle', 'Notifications')}
      </h3>
      <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
        {/* Push Notifications */}
        <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.pushNotif', 'Push Notifications')}</p>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.pushNotifDesc', 'Receive real-time safety updates')}
            </p>
          </div>
          <Switch active={pushNotifications} onClick={() => setPushNotifications(!pushNotifications)} />
        </div>

        {/* Critical Alerts Only */}
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.criticalAlerts', 'Critical Alerts Only')}</p>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.criticalAlertsDesc', 'Only notify for immediate threats')}
            </p>
          </div>
          <Switch active={criticalAlertsOnly} onClick={() => setCriticalAlertsOnly(!criticalAlertsOnly)} />
        </div>
      </div>
    </section>
  );
}
