import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken } from '../api/client';

interface PlayerSession {
  playerId: string;
  name: string;
  token: string;
}
interface PlayerContextValue {
  player: PlayerSession | null;
  login: (name: string, pin: string) => Promise<void>;
  logout: () => void;
  /** Update the displayed name after a successful rename. */
  updateName: (name: string) => void;
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

export function PlayerProvider({ children }: { children: ReactNode }): ReactNode {
  const [player, setPlayer] = useState<PlayerSession | null>(loadSession);

  useEffect(() => {
    setAuthToken(player?.token ?? null);
  }, [player]);

  const login = async (name: string, pin: string): Promise<void> => {
    const res = await api.login(name, pin);
    const session: PlayerSession = { playerId: res.playerId, name: res.name, token: res.token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuthToken(session.token);
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

  return <Ctx.Provider value={{ player, login, logout, updateName }}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePlayer must be used within PlayerProvider');
  return value;
}
