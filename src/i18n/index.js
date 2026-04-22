import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// English (canonical source)
import enCommon     from './locales/en/common.json'
import enOnboarding from './locales/en/onboarding.json'
import enSettings   from './locales/en/settings.json'
import enErrors     from './locales/en/errors.json'
import enDashboard  from './locales/en/dashboard.json'
import enPlantModal from './locales/en/plantModal.json'
import enAnalytics  from './locales/en/analytics.json'
import enCalendar   from './locales/en/calendar.json'

// Spanish
import esCommon     from './locales/es/common.json'
import esOnboarding from './locales/es/onboarding.json'
import esSettings   from './locales/es/settings.json'
import esErrors     from './locales/es/errors.json'
import esDashboard  from './locales/es/dashboard.json'
import esPlantModal from './locales/es/plantModal.json'
import esAnalytics  from './locales/es/analytics.json'
import esCalendar   from './locales/es/calendar.json'

// French
import frCommon     from './locales/fr/common.json'
import frOnboarding from './locales/fr/onboarding.json'

// German
import deCommon     from './locales/de/common.json'
import deOnboarding from './locales/de/onboarding.json'

// Portuguese
import ptCommon     from './locales/pt/common.json'
import ptOnboarding from './locales/pt/onboarding.json'

// Japanese
import jaCommon     from './locales/ja/common.json'
import jaOnboarding from './locales/ja/onboarding.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',    nativeName: 'English' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español' },
  { code: 'fr', name: 'French',     nativeName: 'Français' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語' },
]

const NS = ['common', 'onboarding', 'settings', 'errors', 'dashboard', 'plantModal', 'analytics', 'calendar']

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: enCommon, onboarding: enOnboarding, settings: enSettings, errors: enErrors, dashboard: enDashboard, plantModal: enPlantModal, analytics: enAnalytics, calendar: enCalendar },
        es: { common: esCommon, onboarding: esOnboarding, settings: esSettings, errors: esErrors, dashboard: esDashboard, plantModal: esPlantModal, analytics: esAnalytics, calendar: esCalendar },
        fr: { common: frCommon, onboarding: frOnboarding },
        de: { common: deCommon, onboarding: deOnboarding },
        pt: { common: ptCommon, onboarding: ptOnboarding },
        ja: { common: jaCommon, onboarding: jaOnboarding },
      },
      ns: NS,
      defaultNS: 'common',
      fallbackLng: 'en',
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'plantTracker_language',
        caches: ['localStorage'],
      },
      interpolation: {
        escapeValue: false,
      },
    })
}

export default i18n
