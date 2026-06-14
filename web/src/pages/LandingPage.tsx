import { useState, type FormEvent } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ApiError } from '../api/client';

export function LandingPage() {
  const { login } = usePlayer();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(name, pin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in');
    } finally {
      setBusy(false);
    }
  };

  const pinValid = /^\d{4}$/.test(pin);

  return (
    <div className="landing">
      <img src="/logo.png" alt="" className="landing-logo" />
      <h1>WC Predictions <span className="accent">2026</span></h1>
      <p className="muted">Pick scorelines, beat your friends. Enter a name and a 4-digit PIN to start or resume.</p>
      <form onSubmit={submit} className="card login-form">
        <label>
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            required
            data-testid="login-name"
          />
        </label>
        <label>
          4-digit PIN
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="••••"
            data-testid="login-pin"
          />
        </label>
        {error && <p className="error" data-testid="login-error">{error}</p>}
        <button type="submit" disabled={!name.trim() || !pinValid || busy} data-testid="login-submit">
          {busy ? 'Please wait…' : 'Enter'}
        </button>
      </form>
      <p className="fine muted">No email needed. Use the same name + PIN on any device to resume.</p>
    </div>
  );
}
