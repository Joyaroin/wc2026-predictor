import type { CSSProperties } from 'react';
import type { MatchView } from '../api/client';
import { Flag } from './Flag';

/** One knockout tie in the bracket: two team rows with scores; the losing side is struck through. */
export function BracketMatch({ match, className = '', style }: { match: MatchView; className?: string; style?: CSSProperties }) {
  const decided = match.status === 'FINISHED' && (match.winner === 'HOME' || match.winner === 'AWAY');

  const row = (side: 'HOME' | 'AWAY') => {
    const code = side === 'HOME' ? match.homeCode : match.awayCode;
    const name = side === 'HOME' ? match.homeTeam : match.awayTeam;
    const score = side === 'HOME' ? match.homeScore : match.awayScore;
    const lost = decided && match.winner !== side;
    return (
      <div className={`br-team${lost ? ' lost' : ''}`}>
        {match.placeholder ? (
          <span className="br-tbd">TBD</span>
        ) : (
          <>
            <Flag code={code} name={name} />
            <span className="br-code">{code ?? name}</span>
          </>
        )}
        <span className="br-score">{score ?? ''}</span>
      </div>
    );
  };

  return (
    <div className={`br-match${className ? ` ${className}` : ''}`} style={style} data-testid={`br-match-${match.id}`}>
      {row('HOME')}
      {row('AWAY')}
    </div>
  );
}
