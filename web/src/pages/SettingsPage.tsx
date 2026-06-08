import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { usePrefs, AUTO, listTimeZones } from '../context/PrefsContext';

export function SettingsPage() {
  const { player } = usePlayer();
  const { tzPref, timeZone, setTzPref } = usePrefs();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  const changePin = useMutation({
    mutationFn: () => api.changePin(currentPin, newPin),
    onSuccess: () => {
      setMessage('PIN updated.');
      setError(null);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    },
    onError: (e) => {
      setMessage(null);
      setError(e instanceof ApiError ? e.message : 'Could not change PIN');
    },
  });

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match');
      return;
    }
    changePin.mutate();
  };

  const valid = /^\d{4}$/.test(currentPin) && /^\d{4}$/.test(newPin) && /^\d{4}$/.test(confirmPin);

  return (
    <div className="settings">
      <h2>Account settings</h2>
      <p className="muted">Signed in as <strong>{player?.name}</strong></p>

      <div className="card">
        <h3>Timezone</h3>
        <p className="muted fine">Match times display in this timezone. "Auto" follows your device's location.</p>
        <label>
          Show times in
          <select value={tzPref} onChange={(e) => setTzPref(e.target.value)} data-testid="tz-select">
            <option value={AUTO}>Auto — your device ({timeZone})</option>
            {listTimeZones().map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>
      </div>

      <form className="card" onSubmit={submit}>
        <h3>Change PIN</h3>
        <label>
          Current PIN
          <input value={currentPin} onChange={(e) => setCurrentPin(onlyDigits(e.target.value))} inputMode="numeric" data-testid="current-pin" />
        </label>
        <label>
          New PIN
          <input value={newPin} onChange={(e) => setNewPin(onlyDigits(e.target.value))} inputMode="numeric" data-testid="new-pin" />
        </label>
        <label>
          Confirm new PIN
          <input value={confirmPin} onChange={(e) => setConfirmPin(onlyDigits(e.target.value))} inputMode="numeric" data-testid="confirm-pin" />
        </label>
        {error && <p className="error" data-testid="settings-error">{error}</p>}
        {message && <p className="success" data-testid="settings-message">{message}</p>}
        <button type="submit" disabled={!valid || changePin.isPending} data-testid="change-pin-button">
          {changePin.isPending ? 'Saving…' : 'Update PIN'}
        </button>
      </form>
    </div>
  );
}
