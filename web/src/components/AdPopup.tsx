import { useMemo, useState } from 'react';

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
    label: 'Follow Dany on Insta 📸',
    coin: '📸',
    action: { kind: 'link', href: 'https://www.instagram.com/hilya.b176?igsh=MXEwY2hmc2ZhbGJkNQ==' },
  },
];

/** A cheeky floating "ad". One ad is picked at random per page load; ✕ hides it until the next refresh. */
export function AdPopup() {
  const ad = useMemo(() => ADS[Math.floor(Math.random() * ADS.length)]!, []);
  const [closed, setClosed] = useState(false);
  const [modal, setModal] = useState(false);

  if (closed) return null;

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
    </>
  );
}
