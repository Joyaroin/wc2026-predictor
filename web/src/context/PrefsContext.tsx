import { createContext, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'wc2026.tz';
export const AUTO = 'auto';

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
}

const Ctx = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }): ReactNode {
  const [tzPref, setStored] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? AUTO);
  const timeZone = tzPref === AUTO ? detectedZone() : tzPref;
  const setTzPref = (value: string): void => {
    localStorage.setItem(STORAGE_KEY, value);
    setStored(value);
  };
  return <Ctx.Provider value={{ timeZone, tzPref, setTzPref }}>{children}</Ctx.Provider>;
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
