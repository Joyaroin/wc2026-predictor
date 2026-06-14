import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type DarkHorseTeam } from '../api/client';
import { Flag } from './Flag';
import { ProbabilitiesModal } from './ProbabilitiesModal';

export function TournamentWinnerAward() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['tournament-winner'], queryFn: api.tournamentWinner });

  const pick = useMutation({
    mutationFn: (t: DarkHorseTeam) => api.setTournamentWinner(t.code, t.name),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['tournament-winner'] });
      setModal(false);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save your pick.'),
  });

  const s = q.data;
  return (
    <section className="card award">
      <h2>🏆 Tournament Winner</h2>
      <p className="muted fine">Pick the champion before 13 June. Correct = <b>+10</b> bonus points.</p>
      {q.isLoading && <p className="muted">Loading…</p>}
      {s && (
        <>
          <div className="gb-row">
            <span className="muted">Your pick: </span>
            {s.pick ? (
              <>
                <Flag code={s.pick.teamCode} name={s.pick.teamName} /> <strong>{s.pick.teamName}</strong>
                {s.pick.points > 0 && <span className="points"> +{s.pick.points}</span>}
              </>
            ) : (
              <strong>— none yet —</strong>
            )}
          </div>
          <div className="gb-row">
            <span className="muted">Champion: </span>
            {s.champion ? (
              <><Flag code={s.champion.code} name={s.champion.name} /> <strong>{s.champion.name}</strong></>
            ) : (
              <strong>TBD</strong>
            )}
          </div>
          <button className="odds-btn" onClick={() => setModal(true)} data-testid="tw-open">
            {s.locked ? '📊 View teams' : '🏆 Pick the champion'}
          </button>
          {s.locked && <p className="muted fine">🔒 Picks closed June 13, 2 PM ET.</p>}
          {error && <p className="error fine">{error}</p>}
          {modal && (
            <ProbabilitiesModal
              teams={s.teams}
              pickCode={s.pick?.teamCode}
              locked={s.locked}
              busy={pick.isPending}
              onPick={(t) => pick.mutate(t)}
              onClose={() => setModal(false)}
              // Mirror the button: once locked you're only viewing the field, not picking.
              title={s.locked ? '🏆 Tournament teams' : '🏆 Pick the champion'}
              hint="Tap the team you think will win the whole tournament."
            />
          )}
        </>
      )}
    </section>
  );
}
