import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface Ad {
  id: string;
  img: string;
  label: string;
  coin: string;
  action: { kind: 'modal' } | { kind: 'link'; href: string };
}

const ADS: Ad[] = [
  {
    id: 'tarek',
    img: '/tarek.jpg',
    label: 'Please donate to Tarek 🙏',
    coin: '💸',
    action: { kind: 'modal' },
  },
  {
    id: 'dany',
    img: '/dany.png',
    label: 'Quick question about Dany 🐶',
    coin: '🐶',
    action: { kind: 'modal' },
  },
];

/** A cheeky floating "ad". One ad is picked at random per page load; ✕ hides it until the next refresh. */
export function AdPopup() {
  const flags = useQuery({ queryKey: ['flags'], queryFn: api.flags, staleTime: 60_000 });
  const ad = useMemo(() => ADS[Math.floor(Math.random() * ADS.length)]!, []);
  const [closed, setClosed] = useState(false);
  const [modal, setModal] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const closeModal = () => { setModal(false); setAnswer(null); };

  // Hidden unless the admin flag is on (and until the flag loads).
  if (closed || !flags.data?.adsEnabled) return null;

  const onClick = () => {
    if (ad.action.kind === 'link') window.open(ad.action.href, '_blank', 'noopener,noreferrer');
    else setModal(true);
  };

  return (
    <>
      <div className="ad-fab" data-testid={`ad-${ad.id}`}>
        <button className="ad-bubble" onClick={onClick}>{ad.label}</button>
        <button className="ad-icon" onClick={onClick} aria-label={ad.label}>
          <img src={ad.img} alt="" />
          <span className="ad-coin" aria-hidden>{ad.coin}</span>
        </button>
        <button className="ad-close" onClick={() => setClosed(true)} aria-label="Close" data-testid="ad-close">✕</button>
      </div>

      {modal && ad.id === 'tarek' && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal donate-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Donate to Tarek">
            <div className="modal-head">
              <h3>💸 Donate to Tarek</h3>
              <button className="modal-close" onClick={() => setModal(false)} aria-label="Close">✕</button>
            </div>
            <img className="donate-qr" src="/tarek-qr.jpg" alt="PayPal QR code — scan to pay Tarek Eid" />
            <p className="muted fine" style={{ textAlign: 'center', marginTop: 8 }}>Scan with your phone to pay <b>Tarek Eid</b> on PayPal 🙏</p>
          </div>
        </div>
      )}

      {modal && ad.id === 'dany' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal puppy-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quick question">
            <div className="modal-head">
              <h3>🐶 Quick question</h3>
              <button className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <img className="puppy-img" src="/dany-puppy.jpg" alt="Dany" />
            <p className="puppy-q">dany is a submissive puppy dog</p>
            {answer ? (
              <p className="puppy-result">Knew it. 🐶</p>
            ) : (
              <div className="puppy-options">
                <button className="puppy-opt" onClick={() => setAnswer('yes')} data-testid="puppy-yes">Yes</button>
                <button className="puppy-opt strong" onClick={() => setAnswer('fuck yes')} data-testid="puppy-fuck-yes">Fuck yes</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
