import { useEffect, useState } from 'react';
import { supabase } from '../db/supabaseClient';
import { useTranslation } from 'react-i18next';
import AlertModal, { type AlertType } from './AlertModalProps';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t, i18n } = useTranslation();

  // Toggle and selection states
  const [settings, setSettings] = useState({
    theme: 'Dark Safety (Default)',
    pushNotifications: true,
    criticalAlertsOnly: false,
    shareLocation: true,
    anonymousAnalytics: true,
    autoRetrySos: true,
  });

  const [cacheSize, setCacheSize] = useState('Calculating...');

  const defaultDialogState = {
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as AlertType,
    isConfirm: false,
    isPrompt: false,
    defaultValue: '',
    confirmText: '',
    onConfirm: (val?: string) => {},
    onCancel: () => {},
  };

  const [dialog, setDialog] = useState(defaultDialogState);

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const openDialog = (options: Partial<typeof defaultDialogState>) => {
    setDialog({
      ...defaultDialogState,
      ...options,
      isOpen: true,
    });
  };

  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    openDialog({
      title,
      message,
      type,
      confirmText: 'OK',
      onConfirm: () => closeDialog(),
      onCancel: () => closeDialog(),
    });
  };

  const fetchSystemEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) {
          const sizeInMB = (estimate.usage / (1024 * 1024)).toFixed(2);
          setCacheSize(`${sizeInMB} MB`);
        }
      } catch (e) {
        console.error("Erreur d'estimation", e);
      }
    }
  };

  const calculateStorageSize = () => {
    try {
      const request = window.indexedDB.open('leaflet.offline');

      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const storeNames = Array.from(db.objectStoreNames) as string[];

        // If there are not tables then it's empty
        if (storeNames.length === 0) {
          setCacheSize('0.00 MB');
          db.close();
          return;
        }

        // Else we calculate the number of tiles in the table
        const transaction = db.transaction(storeNames, 'readonly');
        let totalItems = 0;
        let tablesChecked = 0;

        storeNames.forEach((storeName) => {
          const countRequest = transaction.objectStore(storeName).count();

          countRequest.onsuccess = () => {
            totalItems += countRequest.result;
            tablesChecked++;

            if (tablesChecked === storeNames.length) {
              db.close();
              if (totalItems === 0) {
                // It's empty so we force the view to display 0
                setCacheSize('0.00 MB');
              } else {
                // If there are data we ask the browser for the size in MB
                fetchSystemEstimate();
              }
            }
          };
        });
      };

      request.onerror = () => {
        // If there is an error we assume it's empty
        setCacheSize('0.00 MB');
      };
    } catch (error) {
      console.error('IndexedDB verification error :', error);
      fetchSystemEstimate(); // Fallback
    }
  };

  useEffect(() => {
    calculateStorageSize();
  }, []);

  const clearMapCache = () => {
    openDialog({
      title: 'Clear Cache',
      message: 'Are you sure you want to clear the offline map cache?',
      type: 'danger',
      isConfirm: true,
      confirmText: 'Clear',
      onCancel: () => closeDialog(),
      onConfirm: () => {
        closeDialog();

        try {
          const request = window.indexedDB.open('leaflet.offline');

          request.onsuccess = (event: any) => {
            const db = event.target.result;
            const storeNames = Array.from(db.objectStoreNames) as string[];

            if (storeNames.length === 0) {
              db.close();
              setCacheSize('0.00 MB');
              return;
            }

            const transaction = db.transaction(storeNames, 'readwrite');

            storeNames.forEach((storeName) => {
              transaction.objectStore(storeName).clear();
            });

            // When the deletion is confirmed we refresh the view to 0
            transaction.oncomplete = () => {
              db.close();
              setCacheSize('0.00 MB');
              showAlert('Success', 'The map cache has been successfully cleared.', 'success');
            };

            transaction.onerror = () => {
              console.error('Error during cleanup transaction');
              showAlert('Error', 'Error clearing cache.', 'danger');
            };
          };

          request.onerror = (event) => {
            console.error('Error opening IndexedDB', event);
            showAlert('Access Denied', 'Unable to access local cache.', 'danger');
          };
        } catch (error) {
          console.error('Unexpected error :', error);
          showAlert('Error', 'An unexpected error has occurred.', 'danger');
        }
      },
    });
  };

  // Type-safe toggle function for boolean settings
  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English (US)', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('eris_language', lng);
    setIsLanguageMenuOpen(false);
  };

  // Handle secure logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // App.tsx is listening to auth state changes and will automatically redirect to AuthScreen
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Reusable Switch Component
  const Switch = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ease-in-out ${active ? 'bg-blue-500' : 'bg-gray-700'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${active ? 'left-6' : 'left-1'}`}
      ></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-10">
      <AlertModal
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        isConfirm={dialog.isConfirm}
        isPrompt={dialog.isPrompt}
        defaultValue={dialog.defaultValue}
        confirmText={dialog.confirmText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />

      {/* ─── HEADER ─── */}
      <header className="flex items-center px-6 py-4 sticky top-0 z-50 bg-[#0f141e]/90 backdrop-blur-md">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-white text-xl font-bold tracking-wide">{t('settings.title', 'Settings')}</h2>
      </header>

      <div className="px-4 flex flex-col gap-6 mt-2">
        {/* ─── DISPLAY & LANGUAGE ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.displayLanguage', 'Display & Language')}
          </h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden flex flex-col">
            {/* Language Selector (Collapsible Design) */}
            <div className="flex flex-col border-b border-gray-700/30">
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
              >
                <div>
                  <p className="text-white text-sm font-medium">{t('settings.appLanguage', 'Application Language')}</p>
                  <p className="text-blue-400 text-[11px] font-bold mt-0.5">
                    {languages.find((l) => l.code === i18n.language)?.name || 'English (US)'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-500 text-lg">translate</span>
                  <span
                    className={`material-symbols-outlined text-gray-500 transition-transform duration-200 ${isLanguageMenuOpen ? 'rotate-180' : ''}`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {/* Languages List - Collapsible */}
              {isLanguageMenuOpen && (
                <div className="bg-gray-900/40 border-t border-gray-700/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full flex items-center justify-between p-4 text-sm text-left transition-colors border-b border-gray-700/10 last:border-0 ${
                        i18n.language === lang.code
                          ? 'bg-blue-600/10 text-blue-400 font-bold'
                          : 'text-gray-300 hover:bg-gray-700/30'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-base">{lang.flag}</span>
                        {lang.name}
                      </span>
                      {i18n.language === lang.code && (
                        <span className="material-symbols-outlined text-base">check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Selector */}
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.visualTheme', 'Visual Theme')}</p>
                <p className="text-blue-400 text-[11px] font-bold mt-0.5">{settings.theme}</p>
              </div>
              <span className="material-symbols-outlined text-gray-500">dark_mode</span>
            </div>
          </div>
        </section>

        {/* ─── NOTIFICATIONS ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.notificationsTitle', 'Notifications')}
          </h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.pushNotif', 'Push Notifications')}</p>
                <p className="text-gray-500 text-[11px]">
                  {t('settings.pushNotifDesc', 'Receive real-time safety updates')}
                </p>
              </div>
              <Switch active={settings.pushNotifications} onClick={() => toggle('pushNotifications')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.criticalAlerts', 'Critical Alerts Only')}</p>
                <p className="text-gray-500 text-[11px]">
                  {t('settings.criticalAlertsDesc', 'Only notify for immediate threats')}
                </p>
              </div>
              <Switch active={settings.criticalAlertsOnly} onClick={() => toggle('criticalAlertsOnly')} />
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SAFETY ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.privacyTitle', 'Privacy & Safety')}
          </h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.shareLocation', 'Share Live Location')}</p>
                <p className="text-gray-500 text-[11px]">
                  {t('settings.shareLocationDesc', 'Allow rescue teams to find you')}
                </p>
              </div>
              <Switch active={settings.shareLocation} onClick={() => toggle('shareLocation')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.analytics', 'Anonymous Analytics')}</p>
                <p className="text-gray-500 text-[11px]">
                  {t('settings.analyticsDesc', 'Help us improve the ERIS network')}
                </p>
              </div>
              <Switch active={settings.anonymousAnalytics} onClick={() => toggle('anonymousAnalytics')} />
            </div>
          </div>
        </section>

        {/* ─── DATA & STORAGE ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.dataTitle', 'Data & Storage')}
          </h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.autoRetry', 'Auto-Retry SOS')}</p>
                <p className="text-gray-500 text-[11px]">
                  {t('settings.autoRetryDesc', 'Automatically re-send if signal is lost')}
                </p>
              </div>
              <Switch active={settings.autoRetrySos} onClick={() => toggle('autoRetrySos')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">{t('settings.offlineCache', 'Offline Map Cache')}</p>
                <p className="text-gray-500 text-[11px]">
                  {t('settings.offlineCacheDesc', 'Currently using {{size}}', { size: cacheSize })}
                </p>
              </div>
              <button
                onClick={clearMapCache}
                disabled={cacheSize === '0.00 MB' || cacheSize === 'Calcul en cours...'}
                className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${
                  cacheSize === '0.00 MB' || cacheSize === 'Calcul en cours...'
                    ? 'text-gray-500 bg-gray-700/30 cursor-not-allowed'
                    : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95'
                }`}
              >
                {t('settings.clearCache', 'Clear Cache')}
              </button>
            </div>
          </div>
        </section>

        {/* ─── SYSTEM DIAGNOSTICS ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.diagnosticsTitle', 'System Diagnostics')}
          </h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">LoRa Module</span>
              <span className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-400/10 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>{' '}
                {t('settings.connected', 'Connected')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Mesh Network</span>
              <span className="text-blue-400 text-xs font-bold bg-blue-500/10 px-3 py-1 rounded-full">
                {t('settings.searching', 'Searching...')}
              </span>
            </div>
            <button className="mt-2 w-full py-3 bg-gray-700/50 text-white text-xs font-bold rounded-2xl border border-gray-600/50 hover:bg-gray-700 transition-colors active:scale-95">
              {t('settings.runTest', 'Run Network Test')}
            </button>
          </div>
        </section>

        {/* ─── LOGOUT BUTTON ─── */}
        <button
          onClick={handleLogout}
          className="mt-4 mb-8 w-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 py-4 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">logout</span>
          {t('settings.logoutBtn', 'Sign Out of ERIS System')}
        </button>
      </div>
    </div>
  );
}
