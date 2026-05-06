/**
 * DisplaySection.tsx
 *
 * Handles the application language selection and the visual theme modal.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DisplaySectionProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

const THEMES = [
  { id: 'dark', nameKey: 'settings.themes.dark', defaultName: 'Dark Safety', icon: 'dark_mode' },
  { id: 'light', nameKey: 'settings.themes.light', defaultName: 'Light Mode', icon: 'light_mode' },
  { id: 'contrasted', nameKey: 'settings.themes.contrasted', defaultName: 'High Contrast', icon: 'contrast' },
];

const LANGUAGES = [
  { code: 'en', name: 'English (US)', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
];

export default function DisplaySection({ currentTheme, onThemeChange }: DisplaySectionProps) {
  const { t, i18n } = useTranslation();

  // Local states
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('eris_language', lng);
    setIsLanguageMenuOpen(false);
  };

  return (
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
              <p className="text-eris-text text-sm font-medium">{t('settings.appLanguage', 'Application Language')}</p>
              <p className="text-eris-primary text-[11px] font-bold mt-0.5">
                {LANGUAGES.find((l) => l.code === i18n.language)?.name || 'English (US)'}
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
              {LANGUAGES.map((lang) => (
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
                  {i18n.language === lang.code && <span className="material-symbols-outlined text-base">check</span>}
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
              {t(`settings.themes.${currentTheme}`, THEMES.find((th) => th.id === currentTheme)?.defaultName || '')}
            </p>
          </div>
          <span className="material-symbols-outlined text-eris-text-subtle">
            {THEMES.find((th) => th.id === currentTheme)?.icon || 'dark_mode'}
          </span>
        </div>
      </div>

      {/* ─── THEME SELECTION MODAL ─── */}
      {showThemeSelector && (
        <div className="fixed inset-0 z-[6000] bg-eris-bg/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
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
                    currentTheme === th.id
                      ? 'bg-eris-primary/20 border-eris-primary text-eris-primary'
                      : 'bg-eris-surface-alt/40 border-eris-border/50 text-eris-text-muted hover:bg-eris-surface-alt'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">{th.icon}</span>
                    <span className="text-sm font-bold">{t(th.nameKey, th.defaultName)}</span>
                  </div>
                  {currentTheme === th.id && (
                    <span className="material-symbols-outlined text-eris-primary text-xl">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
