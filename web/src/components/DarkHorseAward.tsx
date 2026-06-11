import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type DarkHorseTeam } from '../api/client';
import { Flag } from './Flag';
import { ProbabilitiesModal } from './ProbabilitiesModal';

function ordinal(n: number): string {
  if (!n) return '—';
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

export function DarkHorseAward() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const q = useQuery({ queryKey: ['dark-horse'], queryFn: api.darkHorse });

  const pick = useMutation({
    mutationFn: (t: DarkHorseTeam) => api.setDarkHorse(t.code, t.name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dark-horse'] });
      setModal(false);
    },
  });

  const s = q.data;
  return (
    <section className="card award">
      <h2>🐴 Dark Horse</h2>
      <p className="muted fine">
        Pick a team. Score = win-probability × deepest round reached — the <b>lowest</b> wins (a big underdog that goes far).
        Placements pay <b>+20 / +10 / +5</b>.
      </p>
      {q.isLoading && <p className="muted">Loading…</p>}
      {s && (
        <>
          <div className="gb-row">
            <span className="muted">Your pick: </span>
            {s.pick ? (
              <>
                <Flag code={s.pick.teamCode} name={s.pick.teamName} /> <strong>{s.pick.teamName}</strong>{' '}
                <span className="muted fine">· reached {s.pick.stage} · score {s.pick.score.toFixed(1)} · {ordinal(s.pick.placement)} of {s.totalPicks}</span>
                {s.pick.points > 0 && <span className="points"> +{s.pick.points}</span>}
              </>
            ) : (
              <strong>— none yet —</strong>
            )}
          </div>
          <button className="odds-btn" onClick={() => setModal(true)} data-testid="dh-open-odds">
            📊 View odds{s.locked ? '' : ' & pick'}
          </button>
          {s.locked && <p className="muted fine">🔒 Picks closed June 13, 2 PM ET.</p>}
          {modal && (
            <ProbabilitiesModal
              teams={s.teams}
              pickCode={s.pick?.teamCode}
              locked={s.locked}
              onPick={(t) => pick.mutate(t)}
              onClose={() => setModal(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
