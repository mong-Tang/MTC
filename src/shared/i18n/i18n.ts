import en from '../../locales/en.json';
import ko from '../../locales/ko.json';

export type Locale = 'ko' | 'en';

type Dictionary = Record<string, string>;
type Dictionaries = Record<Locale, Dictionary>;

const dictionaries: Dictionaries = { ko, en };

let currentLocale: Locale = 'ko';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const fallbackLocale: Locale = currentLocale === 'ko' ? 'en' : 'ko';
  const source = dictionaries[currentLocale]?.[key] ?? dictionaries[fallbackLocale]?.[key] ?? key;

  if (source === key) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${key}`);
  }

  if (!params) {
    return source;
  }

  return Object.entries(params).reduce((acc, [paramKey, value]) => {
    return acc.replaceAll(`{${paramKey}}`, String(value));
  }, source);
}
