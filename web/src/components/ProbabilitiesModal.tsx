import { useEffect, useRef } from 'react';
import { Flag } from './Flag';
import type { DarkHorseTeam } from '../api/client';

export function ProbabilitiesModal({
  teams,
  pickCode,
  locked,
  busy,
  onPick,
  onClose,
  title = '📊 Win probabilities',
  hint,
}: {
  teams: DarkHorseTeam[];
  pickCode: string | undefined;
  locked: boolean;
  busy?: boolean;
  onPick: (t: DarkHorseTeam) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  const max = Math.max(...teams.map((t) => t.prob), 1);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, and move focus to the close button when the dialog opens.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted fine">
          {locked ? '🔒 Picks are locked.' : (hint ?? 'Tap a team to set your Dark Horse — the longer the odds, the more you score if they go far.')}
        </p>
        <ul className="odds-list">
          {teams.map((t) => (
            <li key={t.code} className={t.code === pickCode ? 'picked' : ''}>
              <button disabled={locked || busy} onClick={() => onPick(t)} data-testid={`odds-${t.code}`}>
                <Flag code={t.code} name={t.name} />
                <span className="odds-name">{t.name}{t.code === pickCode ? ' ✓' : ''}</span>
                <span className="odds-bar"><span style={{ width: `${(t.prob / max) * 100}%` }} /></span>
                <span className="odds-pct">{t.prob}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
