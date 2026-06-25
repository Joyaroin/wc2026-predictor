import { useEffect, useRef } from 'react';
import type { Prediction } from '@wc2026/shared';

const validScore = (h: number, a: number) =>
  Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0 && h <= 30 && a <= 30;

interface Args {
  matchId: string;
  editable: boolean;
  home: string;
  away: string;
  prediction: Prediction | undefined;
  onSave: (matchId: string, home: number, away: number) => void;
  onClear: (matchId: string) => void;
}

/**
 * Auto-save a scoreline: persists as soon as both boxes hold a valid number (debounced),
 * and auto-removes when both are cleared. There is no Save button. Returns `flushSave` to
 * persist immediately (e.g. on blur / Enter) so dependent bonus buttons unlock sooner.
 */
export function usePredictionAutosave({ matchId, editable, home, away, prediction, onSave, onClear }: Args) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  useEffect(() => {
    if (!editable) return;
    clearTimeout(saveTimer.current);
    if (home !== '' && away !== '') {
      const h = Number(home);
      const a = Number(away);
      if (!validScore(h, a)) return;
      if (prediction && h === prediction.home && a === prediction.away) return; // unchanged
      saveTimer.current = setTimeout(() => onSave(matchId, h, a), 600);
    } else if (home === '' && away === '' && prediction) {
      saveTimer.current = setTimeout(() => onClear(matchId), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, editable, prediction?.home, prediction?.away]);

  const flushSave = () => {
    if (!editable || home === '' || away === '') return;
    const h = Number(home);
    const a = Number(away);
    if (validScore(h, a) && (!prediction || h !== prediction.home || a !== prediction.away)) {
      clearTimeout(saveTimer.current);
      onSave(matchId, h, a);
    }
  };

  return { flushSave };
}
