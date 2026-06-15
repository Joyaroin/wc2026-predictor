import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'wc2026.tz';
const THEME_KEY = 'wc2026.theme';
const LIVEFEED_KEY = 'wc2026.liveFeed';
export const AUTO = 'auto';
export const DEFAULT_THEME = 'default';

/** Available themes: default (dark), light, plus country palettes keyed by FIFA code. */
export const THEMES: { id: string; label: string; flag?: string }[] = [
  { id: 'default', label: 'Default (dark)' },
  { id: 'light', label: 'Light' },
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
  { id: 'URY', label: 'Uruguay', flag: 'URY' },
  { id: 'JPN', label: 'Japan', flag: 'JPN' },
  { id: 'KOR', label: 'South Korea', flag: 'KOR' },
  { id: 'MAR', label: 'Morocco', flag: 'MAR' },
  { id: 'SEN', label: 'Senegal', flag: 'SEN' },
  { id: 'AUS', label: 'Australia', flag: 'AUS' },
  { id: 'SWE', label: 'Sweden', flag: 'SWE' },
  { id: 'QAT', label: 'Qatar', flag: 'QAT' },
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
  /** Show the in-app live-score notifications bell (separate from browser push). */
  liveFeed: boolean;
  setLiveFeed: (on: boolean) => void;
}

const Ctx = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }): ReactNode {
  const [tzPref, setStored] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? AUTO);
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME);
  const [liveFeed, setLiveFeedState] = useState<boolean>(() => localStorage.getItem(LIVEFEED_KEY) !== '0');
  const timeZone = tzPref === AUTO ? detectedZone() : tzPref;

  const setLiveFeed = (on: boolean): void => {
    localStorage.setItem(LIVEFEED_KEY, on ? '1' : '0');
    setLiveFeedState(on);
  };

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
    if (theme === DEFAULT_THEME) delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return <Ctx.Provider value={{ timeZone, tzPref, setTzPref, theme, setTheme, liveFeed, setLiveFeed }}>{children}</Ctx.Provider>;
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
