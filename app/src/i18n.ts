/*
 * i18next configuration for the ERIS Safety app.
 * Loads translation bundles for English, French, Vietnamese, Chinese, and
 * Malagasy from the locales/ directory and initialises the react-i18next
 * integration. The active language is persisted in localStorage under the key
 * 'eris_language' and falls back to English when no preference is stored.
 * Imported once in main.tsx before the React tree is mounted.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';
import mg from './locales/mg.json';

// Get stored language or default to English
const savedLanguage = localStorage.getItem('eris_language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      vi: { translation: vi },
      zh: { translation: zh },
      mg: { translation: mg },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
