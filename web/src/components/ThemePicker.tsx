import { useState } from 'react';
import { usePrefs, THEMES } from '../context/PrefsContext';
import { Flag } from './Flag';

function Glyph({ id, flag, label }: { id: string; flag?: string; label: string }) {
  if (flag) return <Flag code={flag} name={label} />;
  return <span aria-hidden>{id === 'light' ? '☀️' : '🌙'}</span>;
}

/** Compact theme picker: a single chip that opens a scrollable dropdown of all themes. */
export function ThemePicker({ onPick }: { onPick?: () => void }) {
  const { theme, setTheme } = usePrefs();
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  return (
    <div className="theme-picker">
      <button type="button" className="theme-select" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="theme-select">
        <Glyph id={current.id} flag={current.flag} label={current.label} />
        <span className="tp-label">{current.label}</span>
        <span className={`tp-chev${open ? ' up' : ''}`} aria-hidden>▾</span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="theme-menu" role="listbox" data-testid="theme-menu">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={t.id === theme}
                className={`theme-opt${t.id === theme ? ' on' : ''}`}
                onClick={() => { setTheme(t.id); setOpen(false); onPick?.(); }}
                data-testid={`theme-${t.id}`}
              >
                <Glyph id={t.id} flag={t.flag} label={t.label} />
                <span className="tp-opt-label">{t.label}</span>
                {t.id === theme && <span className="tp-check" aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
