import { useState } from 'react';
import type { Prediction } from '@wc2026/shared';
import type { MatchView } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { matchState, pointsLabel, formatKickoff, stageLabel } from '../lib/format';
import { usePrefs } from '../context/PrefsContext';
import { Flag } from './Flag';

interface Props {
  match: MatchView;
  prediction: Prediction | undefined;
  onSave: (matchId: string, home: number, away: number) => void;
  onJoker: (matchId: string, joker: boolean) => void;
  onFirstTeam: (matchId: string, side: 'HOME' | 'AWAY' | null) => void;
  saving: boolean;
}

export function MatchCard({ match, prediction, onSave, onJoker, onFirstTeam, saving }: Props) {
  const { timeZone } = usePrefs();
  const state = matchState(match);
  const [home, setHome] = useState<string>(prediction ? String(prediction.home) : '');
  const [away, setAway] = useState<string>(prediction ? String(prediction.away) : '');

  const editable = state === 'Open' && !match.placeholder;
  const canSave = editable && home !== '' && away !== '';

  return (
    <div className="match-card" data-testid={`match-${match.id}`}>
      <div className="match-head">
        <span className="stage">{stageLabel(match.stage, match.groupName)}</span>
        <span className="head-right">
          {prediction?.joker && <span className="joker-badge" title="Joker — points double">★2×</span>}
          <StatusBadge state={state} />
        </span>
      </div>
      <div className="match-teams">
        <span className="team home"><Flag code={match.homeCode} name={match.homeTeam} />{match.homeTeam}</span>
        <span className="vs">vs</span>
        <span className="team away"><Flag code={match.awayCode} name={match.awayTeam} />{match.awayTeam}</span>
      </div>
      <div className="kickoff">{formatKickoff(match.kickoff, timeZone)}</div>

      {state === 'Live' && (
        <div className="result live" data-testid={`live-${match.id}`}>
          <span className="live-dot">●</span> LIVE <strong>{match.homeScore ?? 0}–{match.awayScore ?? 0}</strong>
        </div>
      )}
      {state === 'Played' && (
        <div className="result">
          Result: <strong>{match.homeScore}–{match.awayScore}</strong>
        </div>
      )}

      {editable ? (
        <div className="prediction-edit">
          <input
            type="number"
            min={0}
            max={30}
            value={home}
            onChange={(e) => setHome(e.target.value)}
            data-testid={`pred-home-${match.id}`}
            aria-label="home score"
          />
          <span>–</span>
          <input
            type="number"
            min={0}
            max={30}
            value={away}
            onChange={(e) => setAway(e.target.value)}
            data-testid={`pred-away-${match.id}`}
            aria-label="away score"
          />
          <button
            disabled={!canSave || saving}
            onClick={() => onSave(match.id, Number(home), Number(away))}
            data-testid={`pred-save-${match.id}`}
          >
            Save
          </button>
          <button
            type="button"
            className={prediction?.joker ? 'joker-btn on' : 'joker-btn'}
            disabled={!prediction || saving}
            title={prediction ? 'Double this match (one Joker per match week)' : 'Save a prediction first'}
            onClick={() => onJoker(match.id, !prediction?.joker)}
            data-testid={`joker-${match.id}`}
          >
            {prediction?.joker ? '★ Joker' : '☆ Joker'}
          </button>
          {prediction && (
            <div className="bonus-row" data-testid={`bonus-${match.id}`}>
              <span className="bonus-label" title="First team to score (+2)">1st goal:</span>
              <button
                type="button"
                className={prediction.firstTeam === 'HOME' ? 'firstteam on' : 'firstteam'}
                disabled={saving}
                title={match.homeTeam}
                onClick={() => onFirstTeam(match.id, prediction.firstTeam === 'HOME' ? null : 'HOME')}
                data-testid={`first-home-${match.id}`}
              >
                <Flag code={match.homeCode} name={match.homeTeam} />
              </button>
              <button
                type="button"
                className={prediction.firstTeam === 'AWAY' ? 'firstteam on' : 'firstteam'}
                disabled={saving}
                title={match.awayTeam}
                onClick={() => onFirstTeam(match.id, prediction.firstTeam === 'AWAY' ? null : 'AWAY')}
                data-testid={`first-away-${match.id}`}
              >
                <Flag code={match.awayCode} name={match.awayTeam} />
              </button>
            </div>
          )}
        </div>
      ) : match.placeholder ? (
        <div className="muted">Teams not decided yet</div>
      ) : (
        <div className="prediction-readonly">
          {prediction ? (
            <>
              Your pick: <strong>{prediction.home}–{prediction.away}</strong>
              {state === 'Played' && <span className="points">{pointsLabel(prediction.points)}</span>}
            </>
          ) : (
            <span className="muted">No prediction</span>
          )}
        </div>
      )}
    </div>
  );
}
