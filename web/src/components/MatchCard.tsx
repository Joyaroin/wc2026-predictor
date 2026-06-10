import { useState } from 'react';
import { effectivePoints, type Prediction } from '@wc2026/shared';
import type { MatchView } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { matchState, formatKickoff, stageLabel } from '../lib/format';
import { usePrefs } from '../context/PrefsContext';
import { Flag } from './Flag';

interface Props {
  match: MatchView;
  prediction: Prediction | undefined;
  onSave: (matchId: string, home: number, away: number) => void;
  onJoker: (matchId: string, joker: boolean) => void;
  onFirstTeam: (matchId: string, side: 'HOME' | 'AWAY' | null) => void;
  onFirstScorer: (matchId: string, scorerId: string | null, scorerName: string | null) => void;
  squad: { id: string; name: string; position: string }[];
  saving: boolean;
}

export function MatchCard({ match, prediction, onSave, onJoker, onFirstTeam, onFirstScorer, squad, saving }: Props) {
  const { timeZone } = usePrefs();
  const state = matchState(match);
  const [home, setHome] = useState<string>(prediction ? String(prediction.home) : '');
  const [away, setAway] = useState<string>(prediction ? String(prediction.away) : '');
  const [scorerOpen, setScorerOpen] = useState(false);
  const [scorerQ, setScorerQ] = useState('');
  const scorerMatches = scorerQ.trim().length < 1
    ? squad.slice(0, 20)
    : squad.filter((p) => p.name.toLowerCase().includes(scorerQ.toLowerCase())).slice(0, 20);

  const editable = state === 'Open' && !match.placeholder;
  const canSave = editable && home !== '' && away !== '';
  const ptsText = state === 'Played' && prediction ? `+${effectivePoints(prediction)}` : '–';
  const selectedPos = prediction?.firstScorerId ? squad.find((p) => p.id === prediction.firstScorerId)?.position : undefined;

  const teamSide = (code: string | null, name: string, side: 'home' | 'away') => (
    <div className={`mc-team ${side}`}>
      {match.placeholder ? <span className="mc-flag-tbd" /> : <Flag code={code} name={name} big />}
      <span className="mc-code" title={name}>{code ?? 'TBD'}</span>
    </div>
  );

  const scoreBox = (value: string, set: (v: string) => void, side: 'home' | 'away') =>
    editable ? (
      <input
        className={`mc-box ${value !== '' ? 'filled' : ''}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={30}
        value={value}
        onChange={(e) => set(e.target.value)}
        data-testid={`pred-${side}-${match.id}`}
        aria-label={`${side === 'home' ? match.homeTeam : match.awayTeam} score`}
      />
    ) : (
      <span className={`mc-box ${prediction ? 'filled' : ''}`} aria-label={`${side === 'home' ? match.homeTeam : match.awayTeam} predicted score`}>
        {prediction ? (side === 'home' ? prediction.home : prediction.away) : '–'}
      </span>
    );

  return (
    <div className={`match-card ${prediction?.joker ? 'joker-on' : ''}`} data-testid={`match-${match.id}`}>
      <div className="mc-header">
        <span className="mc-round">{stageLabel(match.stage, match.groupName)}</span>
        <StatusBadge state={state} />
      </div>

      <div className="mc-body">
        <div className="mc-meta">{formatKickoff(match.kickoff, timeZone)}</div>

        <div className="mc-pred">
          {teamSide(match.homeCode, match.homeTeam, 'home')}
          <div className="mc-scores">
            {scoreBox(home, setHome, 'home')}
            <span className="mc-dash">–</span>
            {scoreBox(away, setAway, 'away')}
          </div>
          {teamSide(match.awayCode, match.awayTeam, 'away')}
        </div>

        {state === 'Live' && (
          <div className="mc-result live" data-testid={`live-${match.id}`}>
            <span className="live-dot">●</span> LIVE <strong>{match.homeScore ?? 0}–{match.awayScore ?? 0}</strong>
          </div>
        )}
        {state === 'Played' && (
          <div className="mc-result">FT <strong>{match.homeScore}–{match.awayScore}</strong></div>
        )}
        {match.placeholder && <div className="mc-result muted">Teams not decided yet</div>}

        {editable && (
          <div className="mc-bonus">
            <div className="bonus-title">First team to score</div>
            <div className="firstteam-row">
              <button
                type="button"
                className={prediction?.firstTeam === 'HOME' ? 'firstteam on' : 'firstteam'}
                disabled={!prediction || saving}
                title={prediction ? match.homeTeam : 'Save a score first'}
                onClick={() => onFirstTeam(match.id, prediction?.firstTeam === 'HOME' ? null : 'HOME')}
                data-testid={`first-home-${match.id}`}
              >
                <Flag code={match.homeCode} name={match.homeTeam} big />
              </button>
              <button
                type="button"
                className={prediction?.firstTeam === 'AWAY' ? 'firstteam on' : 'firstteam'}
                disabled={!prediction || saving}
                title={prediction ? match.awayTeam : 'Save a score first'}
                onClick={() => onFirstTeam(match.id, prediction?.firstTeam === 'AWAY' ? null : 'AWAY')}
                data-testid={`first-away-${match.id}`}
              >
                <Flag code={match.awayCode} name={match.awayTeam} big />
              </button>
            </div>

            <div className="bonus-title">First player to score</div>
            <button
              type="button"
              className={prediction?.firstScorerId ? 'select-btn on' : 'select-btn'}
              disabled={!prediction || saving}
              title={prediction ? 'Pick the first goalscorer (+6)' : 'Save a score first'}
              onClick={() => setScorerOpen((o) => !o)}
              data-testid={`scorer-toggle-${match.id}`}
            >
              {prediction?.firstScorerName ? (
                <>{prediction.firstScorerName}{selectedPos ? <span className="pos"> · {selectedPos}</span> : null}</>
              ) : (
                'Select'
              )}
            </button>
            {prediction && scorerOpen && (
              <div className="scorer-pick" data-testid={`scorer-pick-${match.id}`}>
                {squad.length === 0 ? (
                  <span className="muted fine">Squad not available yet.</span>
                ) : (
                  <>
                    <input type="text" value={scorerQ} onChange={(e) => setScorerQ(e.target.value)} placeholder="Search scorer…" aria-label="search scorer" />
                    <ul>
                      {prediction.firstScorerId && (
                        <li><button className="muted" onClick={() => { onFirstScorer(match.id, null, null); setScorerOpen(false); }}>✕ Clear</button></li>
                      )}
                      {scorerMatches.map((p) => (
                        <li key={p.id}>
                          <button
                            className={prediction.firstScorerId === p.id ? 'on' : ''}
                            onClick={() => { onFirstScorer(match.id, p.id, p.name); setScorerOpen(false); }}
                            data-testid={`scorer-${match.id}-${p.id}`}
                          >
                            {p.name}{p.position ? <span className="pos"> · {p.position}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mc-footer">
        <div className="mc-foot-left">
          {editable ? (
            <button
              type="button"
              className={prediction?.joker ? 'joker-btn on' : 'joker-btn'}
              disabled={!prediction || saving}
              title={prediction ? 'Double this match (one Joker per match week)' : 'Save a score first'}
              onClick={() => onJoker(match.id, !prediction?.joker)}
              data-testid={`joker-${match.id}`}
            >
              {prediction?.joker ? '★ Joker' : '☆ Joker'}
            </button>
          ) : prediction?.joker ? (
            <span className="joker-static">★ Joker</span>
          ) : null}
        </div>
        <span className={`pts-bubble ${ptsText === '–' ? 'empty' : ''}`} title="Points" data-testid={`pts-${match.id}`}>{ptsText}</span>
        <div className="mc-foot-right">
          {editable && (
            <button
              className="btn-save"
              disabled={!canSave || saving}
              onClick={() => onSave(match.id, Number(home), Number(away))}
              data-testid={`pred-save-${match.id}`}
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
