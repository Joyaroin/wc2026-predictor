import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [mobileMenu, setMobileMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  useLayoutEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mobile = window.matchMedia('(max-width: 520px)').matches;
      setMobileMenu(mobile);
      if (mobile) {
        setMenuStyle({});
        return;
      }

      const gap = 6;
      const viewportPad = 12;
      const preferredHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
      const openUp = spaceBelow < 190 && rect.top > spaceBelow;
      const maxHeight = Math.max(180, Math.min(preferredHeight, openUp ? rect.top - gap - viewportPad : spaceBelow));
      const top = openUp ? Math.max(viewportPad, rect.top - gap - maxHeight) : rect.bottom + gap;

      setMenuStyle({
        position: 'fixed',
        top,
        left: Math.min(Math.max(viewportPad, rect.left), window.innerWidth - rect.width - viewportPad),
        width: rect.width,
        maxHeight,
      });
    };

    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const menu = open
    ? createPortal(
      <>
        <div className="theme-backdrop" onClick={() => setOpen(false)} />
        <div
          className={`theme-menu theme-menu-portal${mobileMenu ? ' mobile' : ''}`}
          role="listbox"
          style={menuStyle}
          data-testid="theme-menu"
        >
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
      </>,
      document.body,
    )
    : null;

  return (
    <div className={`theme-picker${open ? ' open' : ''}`}>
      <button ref={buttonRef} type="button" className="theme-select" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="theme-select">
        <Glyph id={current.id} flag={current.flag} label={current.label} />
        <span className="tp-label">{current.label}</span>
        <span className={`tp-chev${open ? ' up' : ''}`} aria-hidden>▾</span>
      </button>
      {menu}
    </div>
  );
}
