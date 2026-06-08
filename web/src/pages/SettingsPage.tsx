import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { usePlayer } from '../context/PlayerContext';

export function SettingsPage() {
  const { player } = usePlayer();
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
