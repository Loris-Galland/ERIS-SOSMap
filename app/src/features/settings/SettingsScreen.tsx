import { useEffect, useState } from 'react';
import { supabase } from '../../db/supabaseClient';
import { useTranslation } from 'react-i18next';
import AlertModal, { type AlertType } from '../.././components/AlertModalProps';

interface SettingsScreenProps {
  onBack: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

export default function SettingsScreen({ onBack, currentTheme, onThemeChange }: SettingsScreenProps) {
  const { t, i18n } = useTranslation();

  // Toggle and selection states
  const [settings, setSettings] = useState({
    theme: 'dark',
    pushNotifications: true,
    criticalAlertsOnly: false,
    shareLocation: true,
    anonymousAnalytics: true,
    autoRetrySos: true,
  });

  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const THEMES = [
    { id: 'dark', nameKey: 'settings.themes.dark', defaultName: 'Dark Safety', icon: 'dark_mode' },
    { id: 'light', nameKey: 'settings.themes.light', defaultName: 'Light Mode', icon: 'light_mode' },
    { id: 'contrasted', nameKey: 'settings.themes.contrasted', defaultName: 'High Contrast', icon: 'contrast' },
  ];

  const [cacheSize, setCacheSize] = useState('Calculating...');

  const [autoSosBattery, setAutoSosBattery] = useState(localStorage.getItem('eris_auto_sos_battery') === 'true');

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

    const savedTheme = localStorage.getItem('eris_theme') || 'dark';
    setSettings((prev) => ({ ...prev, theme: savedTheme }));
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
      className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ease-in-out border-2 ${
        active
          ? 'bg-eris-primary border-eris-primary [.theme-contrasted_&]:bg-white [.theme-contrasted_&]:border-white'
          : 'bg-gray-700 border-gray-700 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border-white'
      }`}
    >
      <div
        className={`absolute top-[2.5px] w-4 h-4 rounded-full transition-all duration-200 ${
          active ? 'left-[22px] bg-white [.theme-contrasted_&]:bg-black' : 'left-[3px] bg-white'
        }`}
      ></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-10">
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
      <header className="flex items-center px-6 py-4 sticky top-0 z-50 bg-eris-bg/90 backdrop-blur-md">
        <button
          onClick={onBack}
          className="text-eris-text-muted hover:text-eris-text transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-eris-surface-alt/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-eris-text text-xl font-bold tracking-wide">{t('settings.title', 'Settings')}</h2>
      </header>

      <div className="px-4 flex flex-col gap-6 mt-2">
        {/* ─── DISPLAY & LANGUAGE ─── */}
        <section>
          <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.displayLanguage', 'Display & Language')}
          </h3>
          <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden flex flex-col">
            {/* Language Selector (Collapsible Design) */}
            <div className="flex flex-col border-b border-eris-border/30">
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
              >
                <div>
                  <p className="text-eris-text text-sm font-medium">
                    {t('settings.appLanguage', 'Application Language')}
                  </p>
                  <p className="text-eris-primary text-[11px] font-bold mt-0.5">
                    {languages.find((l) => l.code === i18n.language)?.name || 'English (US)'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-eris-text-subtle text-lg">translate</span>
                  <span
                    className={`material-symbols-outlined text-eris-text-subtle transition-transform duration-200 ${isLanguageMenuOpen ? 'rotate-180' : ''}`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {/* Languages List - Collapsible */}
              {isLanguageMenuOpen && (
                <div className="bg-eris-surface/40 border-t border-eris-border/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full flex items-center justify-between p-4 text-sm text-left transition-colors border-b border-eris-border/10 last:border-0 ${
                        i18n.language === lang.code
                          ? 'bg-eris-primary/10 text-eris-primary font-bold'
                          : 'text-eris-text-muted hover:bg-gray-700/30'
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
            <div
              onClick={() => setShowThemeSelector(true)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div>
                <p className="text-eris-text text-sm font-medium">{t('settings.visualTheme', 'Visual Theme')}</p>
                <p className="text-eris-primary text-[11px] font-bold mt-0.5">
                  {/* Actual theme name */}
                  {t(`settings.themes.${currentTheme}`, THEMES.find((th) => th.id === currentTheme)?.defaultName || '')}
                </p>
              </div>
              <span className="material-symbols-outlined text-eris-text-subtle">
                {/* Actual theme icon */}
                {THEMES.find((th) => th.id === currentTheme)?.icon || 'dark_mode'}
              </span>
            </div>
          </div>
        </section>

        {/* ─── NOTIFICATIONS ─── */}
        <section>
          <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.notificationsTitle', 'Notifications')}
          </h3>
          <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
              <div>
                <p className="text-eris-text text-sm font-medium">{t('settings.pushNotif', 'Push Notifications')}</p>
                <p className="text-eris-text-subtle text-[11px]">
                  {t('settings.pushNotifDesc', 'Receive real-time safety updates')}
                </p>
              </div>
              <Switch active={settings.pushNotifications} onClick={() => toggle('pushNotifications')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-eris-text text-sm font-medium">
                  {t('settings.criticalAlerts', 'Critical Alerts Only')}
                </p>
                <p className="text-eris-text-subtle text-[11px]">
                  {t('settings.criticalAlertsDesc', 'Only notify for immediate threats')}
                </p>
              </div>
              <Switch active={settings.criticalAlertsOnly} onClick={() => toggle('criticalAlertsOnly')} />
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SAFETY ─── */}
        <section>
          <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.privacyTitle', 'Privacy & Safety')}
          </h3>
          <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
              <div>
                <p className="text-eris-text text-sm font-medium">
                  {t('settings.shareLocation', 'Share Live Location')}
                </p>
                <p className="text-eris-text-subtle text-[11px]">
                  {t('settings.shareLocationDesc', 'Allow rescue teams to find you')}
                </p>
              </div>
              <Switch active={settings.shareLocation} onClick={() => toggle('shareLocation')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-eris-text text-sm font-medium">{t('settings.analytics', 'Anonymous Analytics')}</p>
                <p className="text-eris-text-subtle text-[11px]">
                  {t('settings.analyticsDesc', 'Help us improve the ERIS network')}
                </p>
              </div>
              <Switch active={settings.anonymousAnalytics} onClick={() => toggle('anonymousAnalytics')} />
            </div>
          </div>
        </section>

        {/* ─── DATA & STORAGE ─── */}
        <section>
          <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.dataTitle', 'Data & Storage')}
          </h3>
          <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
              <div>
                <p className="text-eris-text text-sm font-medium">{t('settings.autoRetry', 'Auto-Retry SOS')}</p>
                <p className="text-eris-text-subtle text-[11px]">
                  {t('settings.autoRetryDesc', 'Automatically re-send if signal is lost')}
                </p>
              </div>
              <Switch active={settings.autoRetrySos} onClick={() => toggle('autoRetrySos')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-eris-text text-sm font-medium">{t('settings.offlineCache', 'Offline Map Cache')}</p>
                <p className="text-eris-text-subtle text-[11px]">
                  {t('settings.offlineCacheDesc', 'Currently using {{size}}', { size: cacheSize })}
                </p>
              </div>
              <button
                onClick={clearMapCache}
                disabled={cacheSize === '0.00 MB' || cacheSize === 'Calcul en cours...'}
                className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${
                  cacheSize === '0.00 MB' || cacheSize === 'Calcul en cours...'
                    ? 'text-eris-text-subtle bg-gray-700/30 cursor-not-allowed'
                    : 'text-eris-primary bg-eris-primary/10 hover:bg-eris-primary/20 active:scale-95'
                }`}
              >
                {t('settings.clearCache', 'Clear Cache')}
              </button>
            </div>
          </div>
        </section>

        {/* Power Management*/}
        <section>
          <h3 className="text-eris-text-subtle text-xs font-bold uppercase tracking-widest mb-3 px-2">
            Power Management
          </h3>
          <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="material-symbols-outlined text-eris-alert text-sm">battery_alert</span>
                  <p className="text-eris-text text-sm font-medium">Auto-SOS (Critical Battery)</p>
                </div>
                <p className="text-eris-text-subtle text-[11px]">Send last position automatically at 1% battery</p>
              </div>
              <Switch
                active={autoSosBattery}
                onClick={() => {
                  const newValue = !autoSosBattery;
                  setAutoSosBattery(newValue);
                  localStorage.setItem('eris_auto_sos_battery', String(newValue));
                }}
              />
            </div>
          </div>
        </section>

        {/* ─── SYSTEM DIAGNOSTICS ─── */}
        <section>
          <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('settings.diagnosticsTitle', 'System Diagnostics')}
          </h3>
          <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-eris-text-muted text-sm">LoRa Module</span>
              <span className="flex items-center gap-2 text-eris-success text-xs font-bold bg-eris-success/10 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-eris-success rounded-full animate-pulse"></span>{' '}
                {t('settings.connected', 'Connected')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-eris-text-muted text-sm">Mesh Network</span>
              <span className="text-eris-primary text-xs font-bold bg-eris-primary/10 px-3 py-1 rounded-full">
                {t('settings.searching', 'Searching...')}
              </span>
            </div>
            <button className="mt-2 w-full py-3 bg-gray-700/50 text-eris-text text-xs font-bold rounded-2xl border border-gray-600/50 hover:bg-gray-700 transition-colors active:scale-95">
              {t('settings.runTest', 'Run Network Test')}
            </button>
          </div>
        </section>

        {/* ─── LOGOUT BUTTON ─── */}
        <button
          onClick={handleLogout}
          className="mt-4 mb-8 w-full bg-eris-danger/10 border border-eris-danger/30 text-eris-danger hover:bg-eris-danger/20 py-4 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">logout</span>
          {t('settings.logoutBtn', 'Sign Out of ERIS System')}
        </button>
      </div>

      {/* ─── THEME SELECTION MODAL ─── */}
      {showThemeSelector && (
        <div className="absolute inset-0 z-[6000] bg-eris-bg/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-eris-surface border border-eris-border/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-eris-text text-lg font-bold">{t('settings.selectTheme', 'Select Theme')}</h3>
              <button
                onClick={() => setShowThemeSelector(false)}
                className="w-8 h-8 flex items-center justify-center bg-eris-surface-alt rounded-full text-eris-text-muted hover:text-eris-text active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    onThemeChange(th.id);
                    setShowThemeSelector(false);
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-95 ${
                    settings.theme === th.id
                      ? 'bg-eris-primary/20 border-eris-primary text-eris-primary'
                      : 'bg-eris-surface-alt/40 border-eris-border/50 text-eris-text-muted hover:bg-eris-surface-alt'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">{th.icon}</span>
                    <span className="text-sm font-bold">{t(th.nameKey, th.defaultName)}</span>
                  </div>
                  {settings.theme === th.id && (
                    <span className="material-symbols-outlined text-eris-primary text-xl">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
