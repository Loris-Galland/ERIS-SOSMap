import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../db/supabaseClient';

// Import Modular Sections
import DisplaySection from './sections/DisplaySection';
import NotificationsSection from './sections/NotificationsSection';
import PrivacySection from './sections/PrivacySection';
import DataStorageSection from './sections/DataStorageSection';
import PowerMgmtSection from './sections/PowerMgmtSection';
import DiagnosticsSection from './sections/DiagnosticsSection';

interface SettingsScreenProps {
  onBack: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

export default function SettingsScreen({ onBack, currentTheme, onThemeChange }: SettingsScreenProps) {
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check auth session on mount to determine if logout button should be shown
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // App.tsx is listening to auth state changes and will redirect automatically
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-10">
      {/* ─── HEADER ─── */}
      <header className="flex items-center px-6 py-4 sticky top-0 z-50 bg-eris-bg/90 backdrop-blur-md">
        <button
          onClick={onBack}
          className="text-eris-text-muted hover:text-eris-text transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-eris-surface-alt/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-eris-text text-xl font-bold tracking-wide">{t('settings.title', 'Settings')}</h2>
      </header>

      {/* ─── SETTINGS SECTIONS ─── */}
      <div className="px-4 flex flex-col gap-6 mt-2">
        <DisplaySection currentTheme={currentTheme} onThemeChange={onThemeChange} />
        <NotificationsSection />
        <PrivacySection />
        <DataStorageSection />
        <PowerMgmtSection />
        <DiagnosticsSection />

        {/* ─── LOGOUT BUTTON ─── */}
        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="mt-4 mb-8 w-full bg-eris-danger/10 border border-eris-danger/30 text-eris-danger hover:bg-eris-danger/20 py-4 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">logout</span>
            {t('settings.logoutBtn', 'Sign Out of ERIS System')}
          </button>
        )}
      </div>
    </div>
  );
}
