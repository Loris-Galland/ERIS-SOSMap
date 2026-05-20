/**
 * SettingsScreen.tsx
 *
 * Main orchestrator for the application settings.
 * It imports and stacks individual sections to keep the codebase clean and modular.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

// Import Modular Sections
import DisplaySection from './sections/DisplaySection';
import NotificationsSection from './sections/NotificationsSection';
import PrivacySection from './sections/PrivacySection';
import SosSection from './sections/SosSection';
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
      <div className="px-4 flex flex-col gap-6 mt-2 mb-8">
        <DisplaySection currentTheme={currentTheme} onThemeChange={onThemeChange} />
        <NotificationsSection />
        <PrivacySection />
        <SosSection />
        <DataStorageSection />
        <PowerMgmtSection />
        <DiagnosticsSection />
      </div>
    </div>
  );
}
