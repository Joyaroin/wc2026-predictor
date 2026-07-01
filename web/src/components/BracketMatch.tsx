import type { BracketSide } from '@wc2026/shared';
import type { MatchView } from '../api/client';
import { Flag } from './Flag';
import { matchState, pensLabel } from '../lib/format';

/** One knockout tie in the bracket: two team rows, advancer emphasis, and the player's pick marker. */
export function BracketMatch({ match, myAdvancer }: { match: MatchView; myAdvancer: BracketSide | null }) {
  const state = matchState(match);
  const decided = match.status === 'FINISHED' && (match.winner === 'HOME' || match.winner === 'AWAY');
  const hit = decided && myAdvancer != null ? myAdvancer === match.winner : null;

  const row = (side: BracketSide) => {
    const code = side === 'HOME' ? match.homeCode : match.awayCode;
    const name = side === 'HOME' ? match.homeTeam : match.awayTeam;
    const score = side === 'HOME' ? match.homeScore : match.awayScore;
    const advanced = decided && match.winner === side;
    const mine = myAdvancer === side;
    return (
      <div className={`br-team${advanced ? ' adv' : ''}${mine ? ' mine' : ''}`}>
        {match.placeholder ? (
          <span className="br-tbd">TBD</span>
        ) : (
          <>
            <Flag code={code} name={name} />
            <span className="br-code">{code ?? name}</span>
          </>
        )}
        {mine && <span className="br-pick" title="Your pick to advance" aria-label="your pick">◦</span>}
        <span className="br-score">{score ?? ''}</span>
      </div>
    );
  };

  return (
    <div className={`br-match${state === 'Live' ? ' live' : ''}`} data-testid={`br-match-${match.id}`}>
      {row('HOME')}
      {row('AWAY')}
      {pensLabel(match) && <div className="br-pens muted fine">{pensLabel(match)}</div>}
      {hit !== null && (
        <span className={`br-hit ${hit ? 'ok' : 'no'}`} title={hit ? 'Your pick advanced' : 'Your pick went out'}>
          {hit ? '✓' : '✗'}
        </span>
      )}
    </div>
  );
}
