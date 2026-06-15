import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { usePrefs, AUTO, listTimeZones, THEMES } from '../context/PrefsContext';
import { Flag } from '../components/Flag';
import { Avatar, AVATAR_PALETTE } from '../components/Avatar';
import { ordinal } from '../lib/rank';
import { pushSupported, iosNeedsInstall, pushSubscribed, enablePush, disablePush } from '../lib/push';

export function SettingsPage() {
  const { player, updateName, logout } = usePlayer();
  const { tzPref, timeZone, setTzPref, theme, setTheme } = usePrefs();
  const qc = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);
  const flash = (m: string) => setToast(m);

  // Profile + quick stats (reuse the same cached queries the other tabs use).
  const me = useQuery({ queryKey: ['account-me'], queryFn: api.me });
  const global = useQuery({ queryKey: ['global-leaderboard'], queryFn: api.globalLeaderboard, staleTime: 30_000 });
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups, staleTime: 30_000 });
  const myColor = me.data?.avatarColor ?? null;
  const myRank = global.data?.me?.rank;
  const myPoints = global.data?.me?.points ?? 0;
  const myExacts = global.data?.me?.exacts ?? 0;
  const groupCount = groups.data?.length ?? 0;
  const memberSince = me.data?.createdAt
    ? new Date(me.data.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  // Display name
  const [newName, setNewName] = useState('');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: () => api.rename(newName.trim()),
    onSuccess: (res) => { updateName(res.name); setNewName(''); setNameErr(null); flash('Name updated ✓'); void qc.invalidateQueries({ queryKey: ['account-me'] }); },
    onError: (e) => setNameErr(e instanceof ApiError && e.status === 409 ? 'That name is already taken.' : 'Could not change name.'),
  });

  // Avatar colour
  const setColor = useMutation({
    mutationFn: (c: string | null) => api.setAvatarColor(c),
    onSuccess: (p) => { qc.setQueryData(['account-me'], p); flash('Saved ✓'); },
  });

  // PIN
  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const changePin = useMutation({
    mutationFn: () => api.changePin(currentPin, newPin),
    onSuccess: () => { setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinErr(null); flash('PIN updated ✓'); },
    onError: (e) => setPinErr(e instanceof ApiError ? e.message : 'Could not change PIN'),
  });
  const submitPin = (e: FormEvent): void => {
    e.preventDefault();
    if (newPin !== confirmPin) { setPinErr('New PIN and confirmation do not match'); return; }
    changePin.mutate();
  };
  const pinValid = /^\d{4}$/.test(currentPin) && /^\d{4}$/.test(newPin) && newPin === confirmPin;
  const pinType = showPin ? 'text' : 'password';

  // Notifications (Web Push)
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);
  useEffect(() => { pushSubscribed().then(setPushOn).catch(() => {}); }, []);
  const togglePush = async () => {
    setPushBusy(true);
    setPushErr(null);
    try {
      if (pushOn) { await disablePush(); setPushOn(false); flash('Alerts off'); }
      else { await enablePush(); setPushOn(true); flash('Alerts on ✓'); }
    } catch (e) {
      setPushErr(e instanceof Error ? e.message : 'Could not change alerts');
    } finally {
      setPushBusy(false);
    }
  };

  // Admin
  const adminMe = useQuery({ queryKey: ['admin-me'], queryFn: api.feedbackAdminMe });
  const flags = useQuery({ queryKey: ['flags'], queryFn: api.flags });
  const togglePopup = useMutation({
    mutationFn: (on: boolean) => api.setAdsEnabled(on),
    onSuccess: (f) => { qc.setQueryData(['flags'], f); flash('Saved ✓'); },
  });

  return (
    <div className="settings">
      <h2>Account</h2>

      <div className="card profile-card">
        <Avatar name={player?.name ?? '?'} size={64} ring color={myColor} />
        <div className="profile-main">
          <div className="profile-name">{player?.name}</div>
          <div className="profile-stats">
            <span>🌍 {myRank ? ordinal(myRank) : 'unranked'}</span>
            <span className="dot">·</span><span><strong>{myPoints}</strong> pts</span>
            <span className="dot">·</span><span>{myExacts} exact</span>
            <span className="dot">·</span><span>{groupCount} group{groupCount === 1 ? '' : 's'}</span>
          </div>
          {memberSince && <div className="muted fine">Member since {memberSince}</div>}
        </div>
      </div>

      <h3 className="section-head">Profile</h3>
      <div className="card">
        <h4>Display name</h4>
        <p className="muted fine">Change the name shown on leaderboards. You keep all your predictions and points — log in with the new name (same PIN).</p>
        <div className="row stack-sm">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={player?.name} maxLength={30} data-testid="rename-input" />
          <button disabled={newName.trim().length < 2 || rename.isPending} onClick={() => rename.mutate()} data-testid="rename-save">Change</button>
        </div>
        {nameErr && <p className="error fine">{nameErr}</p>}
      </div>
      <div className="card">
        <h4>Avatar colour</h4>
        <p className="muted fine">Personalise your avatar across leaderboards and groups.</p>
        <div className="color-picker">
          {AVATAR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-dot${myColor === c ? ' on' : ''}`}
              style={{ background: c }}
              aria-label={`Avatar colour ${c}`}
              disabled={setColor.isPending}
              onClick={() => setColor.mutate(c)}
              data-testid={`color-${c}`}
            />
          ))}
          {myColor && <button type="button" className="linklike color-reset" onClick={() => setColor.mutate(null)}>Reset to auto</button>}
        </div>
      </div>

      <h3 className="section-head">Appearance</h3>
      <div className="card">
        <h4>Theme</h4>
        <p className="muted fine">Pick a look — dark, light, or one inspired by a World Cup nation.</p>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={theme === t.id ? 'theme-chip on' : 'theme-chip'}
              onClick={() => { setTheme(t.id); flash('Saved ✓'); }}
              data-testid={`theme-${t.id}`}
            >
              {t.flag ? <Flag code={t.flag} name={t.label} /> : <span aria-hidden>{t.id === 'light' ? '☀️' : '🌙'}</span>}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h4>Timezone</h4>
        <p className="muted fine">Match times display in this timezone. "Auto" follows your device.</p>
        <label>
          Show times in
          <select value={tzPref} onChange={(e) => { setTzPref(e.target.value); flash('Saved ✓'); }} data-testid="tz-select">
            <option value={AUTO}>Auto — your device ({timeZone})</option>
            {listTimeZones().map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="section-head">Notifications</h3>
      <div className="card">
        <h4>Match alerts</h4>
        <p className="muted fine">Get a push when a match you predicted kicks off, a goal goes in, or it finishes.</p>
        {iosNeedsInstall() ? (
          <p className="muted fine">📲 On iPhone/iPad: tap <b>Share → Add to Home Screen</b>, open the app from there, then enable alerts.</p>
        ) : !pushSupported() ? (
          <p className="muted fine">Not supported on this browser.</p>
        ) : (
          <div className="toggle-row">
            <button
              type="button"
              className={`switch ${pushOn ? 'on' : ''}`}
              role="switch"
              aria-checked={pushOn}
              disabled={pushBusy}
              onClick={togglePush}
              data-testid="toggle-push"
            >
              <span className="switch-knob" />
            </button>
            <span className="fine">{pushBusy ? '…' : pushOn ? 'On' : 'Off'}</span>
          </div>
        )}
        {pushErr && <p className="error fine">{pushErr}</p>}
      </div>

      <h3 className="section-head">Security</h3>
      <form className="card" onSubmit={submitPin}>
        <h4>Change PIN</h4>
        <label>
          Current PIN
          <input type={pinType} value={currentPin} onChange={(e) => setCurrentPin(onlyDigits(e.target.value))} inputMode="numeric" autoComplete="off" data-testid="current-pin" />
        </label>
        <label>
          New PIN
          <input type={pinType} value={newPin} onChange={(e) => setNewPin(onlyDigits(e.target.value))} inputMode="numeric" autoComplete="off" data-testid="new-pin" />
        </label>
        <label>
          Confirm new PIN
          <input type={pinType} value={confirmPin} onChange={(e) => setConfirmPin(onlyDigits(e.target.value))} inputMode="numeric" autoComplete="off" data-testid="confirm-pin" />
        </label>
        <div className="pin-row">
          <label className="pin-show"><input type="checkbox" checked={showPin} onChange={(e) => setShowPin(e.target.checked)} /> Show PIN</label>
          {confirmPin.length === 4 && (
            <span className={`pin-match ${newPin === confirmPin ? 'ok' : 'no'}`}>{newPin === confirmPin ? 'PINs match ✓' : "PINs don't match ✗"}</span>
          )}
        </div>
        {pinErr && <p className="error" data-testid="settings-error">{pinErr}</p>}
        <button type="submit" disabled={!pinValid || changePin.isPending} data-testid="change-pin-button">
          {changePin.isPending ? 'Saving…' : 'Update PIN'}
        </button>
      </form>

      {adminMe.data?.isAdmin && (
        <>
          <h3 className="section-head">Admin</h3>
          <div className="card">
            <h4>Bottom-right pop-up</h4>
            <p className="muted fine">Show or hide the floating bottom-right pop-up for everyone — takes effect immediately.</p>
            <div className="toggle-row">
              <button
                type="button"
                className={`switch ${flags.data?.adsEnabled ? 'on' : ''}`}
                role="switch"
                aria-checked={!!flags.data?.adsEnabled}
                disabled={flags.isLoading || togglePopup.isPending}
                onClick={() => togglePopup.mutate(!flags.data?.adsEnabled)}
                data-testid="toggle-popup"
              >
                <span className="switch-knob" />
              </button>
              <span className="fine">{flags.data?.adsEnabled ? 'On' : 'Off'}</span>
            </div>
          </div>
        </>
      )}

      <h3 className="section-head">Account actions</h3>
      <div className="card">
        <button type="button" className="btn-logout" onClick={logout} data-testid="logout-account">Log out</button>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
