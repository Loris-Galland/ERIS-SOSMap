// Admin panel entry point — routes to the different admin feature screens

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SOSAlertDashboard from './components/SOSAlertDashboard';
import UserManagementScreen from './components/UserManagementScreen';
import AudioRecordingsDashboard from './components/AudioRecordingsDashboard';

type AdminView = 'home' | 'sos_dashboard' | 'user_management' | 'audio_recordings';

export default function AdminScreen() {
  const { t } = useTranslation();
  const [view, setView] = useState<AdminView>('home');

  // Route to the SOS dashboard sub-screen
  if (view === 'sos_dashboard') {
    return <SOSAlertDashboard onBack={() => setView('home')} />;
  }
  // Route to the User Management sub-screen
  if (view === 'user_management') {
    return <UserManagementScreen onBack={() => setView('home')} />;
  }
  // Route to the Audio Recordings sub-screen
  if (view === 'audio_recordings') {
    return <AudioRecordingsDashboard onBack={() => setView('home')} />;
  }

  return (
    <div className="flex flex-col h-full w-full bg-eris-bg text-eris-text p-6 pt-12 overflow-y-auto">
      <div className="max-w-md mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-eris-danger text-3xl">admin_panel_settings</span>
            <h2 className="text-2xl font-bold">{t('admin.panelTitle', 'Admin Panel')}</h2>
          </div>
          <div className="h-1 w-16 bg-eris-danger rounded-full mb-3" />
          <p className="text-eris-text-muted text-sm">
            {t('admin.panelSubtitle', 'Restricted access — administrator only')}
          </p>
        </div>

        {/* Feature cards — placeholders for upcoming admin US */}
        <div className="flex flex-col gap-4">
          {/* Navigates to dashboard */}
          <button
            onClick={() => setView('sos_dashboard')}
            className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform text-left w-full"
          >
            <span className="material-symbols-outlined text-eris-alert text-2xl">emergency</span>
            <div>
              <p className="font-semibold text-sm">{t('admin.sosTitle', 'SOS Alert Dashboard')}</p>
              <p className="text-eris-text-muted text-xs">{t('admin.sosDesc', 'Real-time alert monitoring')}</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">chevron_right</span>
          </button>

          {/* Navigates to User management*/}
          <button
            onClick={() => setView('user_management')}
            className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform text-left w-full"
          >
            <span className="material-symbols-outlined text-eris-primary text-2xl">group</span>
            <div>
              <p className="font-semibold text-sm">{t('admin.usersTitle', 'User Management')}</p>
              <p className="text-eris-text-muted text-xs">{t('admin.usersDesc', 'Users & roles')}</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">chevron_right</span>
          </button>

          {/* Navigates to audio recordings dashboard */}
          <button
            onClick={() => setView('audio_recordings')}
            className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform text-left w-full"
          >
            <span className="material-symbols-outlined text-eris-danger text-2xl">mic</span>
            <div>
              <p className="font-semibold text-sm">{t('admin.audio.title', 'Audio Recordings')}</p>
              <p className="text-eris-text-muted text-xs">{t('admin.audio.adminDesc', 'Emergency audio captured on fall / crash')}</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">chevron_right</span>
          </button>

          <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4 opacity-50">
            <span className="material-symbols-outlined text-eris-success text-2xl">layers</span>
            <div>
              <p className="font-semibold text-sm">{t('admin.dangerZone', 'Danger Zone Publisher')}</p>
              <p className="text-eris-text-muted text-xs">
                {t('admin.dangerZoneDesc', 'Publish official hazard zones')}
              </p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">chevron_right</span>
          </div>

          <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4 opacity-50">
            <span className="material-symbols-outlined text-eris-text-muted text-2xl">flag</span>
            <div>
              <p className="font-semibold text-sm">{t('admin.hazardMod', 'Hazard Report Moderation')}</p>
              <p className="text-eris-text-muted text-xs">
                {t('admin.hazardModDesc', 'Approve / reject user reports')}
              </p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">chevron_right</span>
          </div>
        </div>
      </div>
    </div>
  );
}
