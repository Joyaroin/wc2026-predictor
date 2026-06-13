import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken, setOnUnauthorized } from '../api/client';

interface PlayerSession {
  playerId: string;
  name: string;
  token: string;
  tourSeen?: boolean;
}
interface PlayerContextValue {
  player: PlayerSession | null;
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
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

// Install the token synchronously at module load so authenticated queries fired
// during the first render (e.g. on a hard reload) carry the Authorization header.
// Without this the token was only set in a useEffect (after paint), causing
// intermittent 401s on those first requests.
setAuthToken(loadSession()?.token ?? null);

export function PlayerProvider({ children }: { children: ReactNode }): ReactNode {
  const queryClient = useQueryClient();
  // Lazy initializer also (re)installs the token synchronously for this component
  // instance, in addition to the module-scope install above.
  const [player, setPlayer] = useState<PlayerSession | null>(() => {
    const session = loadSession();
    setAuthToken(session?.token ?? null);
    return session;
  });

  useEffect(() => {
    setAuthToken(player?.token ?? null);
  }, [player]);

  const login = async (name: string, pin: string): Promise<void> => {
    // Drop any data left in the cache from a previous user on this browser
    // before installing the new session (shared-browser leak guard).
    queryClient.clear();
    const res = await api.login(name, pin);
    const session: PlayerSession = { playerId: res.playerId, name: res.name, token: res.token, tourSeen: res.tourSeen };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuthToken(session.token);
    setPlayer(session);
  };

  const logout = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setPlayer(null);
    // Purge cached queries so the next user (or the logged-out landing page)
    // never sees the previous user's data (staleTime keeps it around otherwise).
    queryClient.clear();
  };

  // Central 401 handling: an expired/invalid session logs the user out
  // (PlayerProvider sits above the router, so dropping `player` redirects to landing).
  useEffect(() => {
    setOnUnauthorized(() => logout());
    return () => setOnUnauthorized(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return <Ctx.Provider value={{ player, login, logout, updateName, setTourSeen }}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePlayer must be used within PlayerProvider');
  return value;
}
