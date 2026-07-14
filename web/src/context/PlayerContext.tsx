import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';

interface PlayerSession {
  playerId: string;
  name: string;
  token: string;
  tourSeen?: boolean;
}
interface PlayerContextValue {
  player: PlayerSession | null;
  /** True when the last session ended because the server rejected its token (expired). */
  sessionExpired: boolean;
  login: (name: string, pin: string) => Promise<void>;
  logout: () => void;
  /** Update the displayed name after a successful rename. */
  updateName: (name: string) => void;
  /** Mark the onboarding tour as seen for this session. */
  setTourSeen: () => void;
}

const STORAGE_KEY = 'wc2026.player';
const Ctx = createContext<PlayerContextValue | null>(null);

function loadSession(): PlayerSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerSession>;
    if (
      typeof parsed.playerId !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.token !== 'string'
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { playerId: parsed.playerId, name: parsed.name, token: parsed.token, tourSeen: parsed.tourSeen };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }): ReactNode {
  const [player, setPlayer] = useState<PlayerSession | null>(() => {
    const session = loadSession();
    setAuthToken(session?.token ?? null);
    return session;
  });

  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setAuthToken(player?.token ?? null);
  }, [player]);

  // An authenticated request 401'd: the stored token is expired or invalid. Clear the
  // session so RequireAuth routes back to login instead of every page erroring forever.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken(null);
      setPlayer(null);
      setSessionExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (name: string, pin: string): Promise<void> => {
    const res = await api.login(name, pin);
    const session: PlayerSession = { playerId: res.playerId, name: res.name, token: res.token, tourSeen: res.tourSeen };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuthToken(session.token);
    setSessionExpired(false);
    setPlayer(session);
  };

  const logout = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setPlayer(null);
  };

  const updateName = (name: string): void => {
    setPlayer((p) => {
      if (!p) return p;
      const session = { ...p, name };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    });
  };

  const setTourSeen = (): void => {
    setPlayer((p) => {
      if (!p || p.tourSeen) return p;
      const session = { ...p, tourSeen: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    });
  };

  return <Ctx.Provider value={{ player, sessionExpired, login, logout, updateName, setTourSeen }}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePlayer must be used within PlayerProvider');
  return value;
}
