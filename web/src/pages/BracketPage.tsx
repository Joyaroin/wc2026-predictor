import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { advancementPoints, type BracketPick, type BracketSide, type Stage } from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { matchState, stageLabel } from '../lib/format';
import { Flag } from '../components/Flag';

const KO_ORDER: Stage[] = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

export function BracketPage() {
  const qc = useQueryClient();
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const picks = useQuery({ queryKey: ['my-bracket'], queryFn: api.myBracket });

  const pick = useMutation({
    mutationFn: ({ matchId, side }: { matchId: string; side: BracketSide }) => api.setBracketPick(matchId, side),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-bracket'] }),
  });

  const pickByMatch = useMemo(() => {
    const m = new Map<string, BracketPick>();
    for (const p of picks.data ?? []) m.set(p.matchId, p);
    return m;
  }, [picks.data]);

  const rounds = useMemo(() => {
    const ko = (matches.data ?? []).filter((m) => m.stage !== 'GROUP_STAGE');
    return KO_ORDER.map((stage) => ({
      stage,
      list: ko.filter((m) => m.stage === stage).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    })).filter((r) => r.list.length > 0);
  }, [matches.data]);

  if (matches.isLoading) return <p>Loading…</p>;

  return (
    <div className="bracket">
      <h2>🏆 Bracket</h2>
      <p className="muted fine">Pick who advances each knockout tie. Correct picks earn escalating bonus points (R32 +2 → Final +16).</p>
      {rounds.length === 0 && <p className="muted">Knockout matches appear once the bracket is set.</p>}
      {rounds.map(({ stage, list }) => (
        <section key={stage}>
          <h3 className="stage-header">{stageLabel(stage, null)} <span className="muted fine">+{advancementPoints(stage)}</span></h3>
          <div className="bracket-list">
            {list.map((m) => (
              <BracketRow key={m.id} match={m} pick={pickByMatch.get(m.id)} busy={pick.isPending} onPick={(side) => pick.mutate({ matchId: m.id, side })} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BracketRow({
  match,
  pick,
  busy,
  onPick,
}: {
  match: MatchView;
  pick: BracketPick | undefined;
  busy: boolean;
  onPick: (side: BracketSide) => void;
}) {
  const state = matchState(match);
  const canPick = !match.placeholder && state === 'Open';
  const decided = match.winner === 'HOME' || match.winner === 'AWAY';

  const teamBtn = (side: BracketSide, name: string, code: string | null) => {
    const picked = pick?.side === side;
    const isWinner = decided && match.winner === side;
    return (
      <button
        className={`pick${picked ? ' on' : ''}${isWinner ? ' winner' : ''}`}
        disabled={!canPick || busy}
        onClick={() => onPick(side)}
        data-testid={`bracket-${match.id}-${side}`}
      >
        <Flag code={code} name={name} />{name}{isWinner ? ' ✓' : ''}
      </button>
    );
  };

  return (
    <div className="bracket-row" data-testid={`bracket-${match.id}`}>
      {match.placeholder ? (
        <span className="muted">{match.homeTeam} vs {match.awayTeam} — to be decided</span>
      ) : (
        <div className="bracket-teams">
          {teamBtn('HOME', match.homeTeam, match.homeCode)}
          <span className="vs">vs</span>
          {teamBtn('AWAY', match.awayTeam, match.awayCode)}
          {pick && decided && (
            <span className={pick.points > 0 ? 'points' : 'muted'}>
              {pick.points > 0 ? `+${pick.points}` : '+0'}
            </span>
          )}
          {state === 'Live' && <span className="badge live">● LIVE</span>}
        </div>
      )}
    </div>
  );
}
