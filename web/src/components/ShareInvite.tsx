import { useState } from 'react';

/** Invite code as a one-tap copy chip + a native Share button (falls back to copy). */
export function ShareInvite({ code, groupName }: { code: string; groupName: string }) {
  const [copied, setCopied] = useState(false);

  const inviteText = `Join my World Cup 2026 predictions group "${groupName}" — use invite code ${code} at ${location.origin}`;

  const flash = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      flash();
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: `${groupName} · WC Predictions 2026`, text: inviteText });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteText);
      flash();
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="share-invite">
      <button className="invite-chip" onClick={copy} title="Copy invite code" data-testid="copy-code">
        <span className="invite-code">{code}</span>
        <span className="invite-icon" aria-hidden>{copied ? '✓' : '⧉'}</span>
      </button>
      <button className="share-btn" onClick={share} data-testid="share-invite">📤 Share invite</button>
      {copied && <span className="share-copied muted fine" role="status">Copied!</span>}
    </div>
  );
}
