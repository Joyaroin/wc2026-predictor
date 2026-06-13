import { useState } from 'react';

/** A cheeky floating "ad" — circular icon of Tarek, bottom-right. Click → his PayPal QR. */
export function DonateTarek() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="donate-fab" onClick={() => setOpen(true)} aria-label="Please donate to Tarek" data-testid="donate-tarek">
        <span className="donate-bubble">Please donate to&nbsp;Tarek 🙏</span>
        <span className="donate-circle">
          <img src="/tarek.jpg" alt="Tarek" />
          <span className="donate-coin" aria-hidden>💸</span>
        </span>
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal donate-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Donate to Tarek">
            <div className="modal-head">
              <h3>💸 Donate to Tarek</h3>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <img className="donate-qr" src="/tarek-qr.jpg" alt="PayPal QR code — scan to pay Tarek Eid" />
            <p className="muted fine" style={{ textAlign: 'center', marginTop: 8 }}>Scan with your phone to pay <b>Tarek Eid</b> on PayPal 🙏</p>
          </div>
        </div>
      )}
    </>
  );
}
