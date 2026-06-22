import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'wc2026.tz';
const THEME_KEY = 'wc2026.theme';
export const AUTO = 'auto';
export const DEFAULT_THEME = 'default';

/** Available themes: default (dark), light, plus country palettes keyed by FIFA code. */
export const THEMES: { id: string; label: string; flag?: string }[] = [
  { id: 'default', label: 'Default (dark)' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'Follow system' },
  { id: 'oled', label: 'OLED black' },
  { id: 'BRA', label: 'Brazil', flag: 'BRA' },
  { id: 'ARG', label: 'Argentina', flag: 'ARG' },
  { id: 'FRA', label: 'France', flag: 'FRA' },
  { id: 'ENG', label: 'England', flag: 'ENG' },
  { id: 'GER', label: 'Germany', flag: 'GER' },
  { id: 'ESP', label: 'Spain', flag: 'ESP' },
  { id: 'POR', label: 'Portugal', flag: 'POR' },
  { id: 'NED', label: 'Netherlands', flag: 'NED' },
  { id: 'MEX', label: 'Mexico', flag: 'MEX' },
  { id: 'USA', label: 'USA', flag: 'USA' },
  { id: 'IRN', label: 'Iran', flag: 'IRN' },
  { id: 'EGY', label: 'Egypt', flag: 'EGY' },
  { id: 'IRQ', label: 'Iraq', flag: 'IRQ' },
  { id: 'CAN', label: 'Canada', flag: 'CAN' },
  { id: 'CRO', label: 'Croatia', flag: 'CRO' },
  { id: 'BEL', label: 'Belgium', flag: 'BEL' },
  { id: 'COL', label: 'Colombia', flag: 'COL' },
  { id: 'URU', label: 'Uruguay', flag: 'URU' },
  { id: 'JPN', label: 'Japan', flag: 'JPN' },
  { id: 'KOR', label: 'South Korea', flag: 'KOR' },
  { id: 'MAR', label: 'Morocco', flag: 'MAR' },
  { id: 'SEN', label: 'Senegal', flag: 'SEN' },
  { id: 'AUS', label: 'Australia', flag: 'AUS' },
  { id: 'SWE', label: 'Sweden', flag: 'SWE' },
  { id: 'QAT', label: 'Qatar', flag: 'QAT' },
  { id: 'NOR', label: 'Norway', flag: 'NOR' },
  { id: 'SUI', label: 'Switzerland', flag: 'SUI' },
  { id: 'KSA', label: 'Saudi Arabia', flag: 'KSA' },
  { id: 'TUR', label: 'Turkey', flag: 'TUR' },
  { id: 'SCO', label: 'Scotland', flag: 'SCO' },
  { id: 'ECU', label: 'Ecuador', flag: 'ECU' },
  { id: 'GHA', label: 'Ghana', flag: 'GHA' },
  { id: 'CIV', label: 'Ivory Coast', flag: 'CIV' },
  { id: 'ALG', label: 'Algeria', flag: 'ALG' },
  { id: 'TUN', label: 'Tunisia', flag: 'TUN' },
  { id: 'RSA', label: 'South Africa', flag: 'RSA' },
  { id: 'AUT', label: 'Austria', flag: 'AUT' },
  { id: 'PAR', label: 'Paraguay', flag: 'PAR' },
  { id: 'JOR', label: 'Jordan', flag: 'JOR' },
  { id: 'NZL', label: 'New Zealand', flag: 'NZL' },
  { id: 'UZB', label: 'Uzbekistan', flag: 'UZB' },
  { id: 'CZE', label: 'Czechia', flag: 'CZE' },
  { id: 'COD', label: 'DR Congo', flag: 'COD' },
  { id: 'CPV', label: 'Cape Verde', flag: 'CPV' },
  { id: 'CUW', label: 'Curacao', flag: 'CUW' },
  { id: 'BIH', label: 'Bosnia & Herz.', flag: 'BIH' },
  { id: 'HAI', label: 'Haiti', flag: 'HAI' },
];

function detectedZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

interface PrefsValue {
  /** Resolved IANA timezone used for display (auto-detected unless overridden). */
  timeZone: string;
  /** The stored preference: `auto` or an IANA zone. */
  tzPref: string;
  setTzPref: (value: string) => void;
  /** Active theme id (see THEMES). */
  theme: string;
  setTheme: (id: string) => void;
}

const Ctx = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }): ReactNode {
  const [tzPref, setStored] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? AUTO);
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME);
  const timeZone = tzPref === AUTO ? detectedZone() : tzPref;

  const setTzPref = (value: string): void => {
    localStorage.setItem(STORAGE_KEY, value);
    setStored(value);
  };
  const setTheme = (id: string): void => {
    localStorage.setItem(THEME_KEY, id);
    setThemeState(id);
  };

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      if (theme === 'system') {
        // Follow the OS: light when the device prefers light, otherwise default dark.
        if (window.matchMedia('(prefers-color-scheme: light)').matches) root.dataset.theme = 'light';
        else delete root.dataset.theme;
      } else if (theme === DEFAULT_THEME) {
        delete root.dataset.theme;
      } else {
        root.dataset.theme = theme;
      }
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  return <Ctx.Provider value={{ timeZone, tzPref, setTzPref, theme, setTheme }}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePrefs must be used within PrefsProvider');
  return value;
}

/** A reasonable, browser-supported list of timezones (falls back to a curated set). */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone');
    } catch {
      /* fall through */
    }
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Madrid',
    'Africa/Cairo',
    'Asia/Qatar',
    'Asia/Dubai',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];
}
