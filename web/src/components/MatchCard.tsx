import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  effectivePoints,
  scoreBreakdown,
  firstGoalPoints,
  SCORE_POINTS,
  FIRST_TEAM_POINTS,
  FIRST_PLAYER_POINTS,
  type Prediction,
} from '@wc2026/shared';
import { api, type MatchView } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { matchState, formatKickoff, stageLabel, liveMinute } from '../lib/format';
import { usePrefs } from '../context/PrefsContext';
import { Flag } from './Flag';
import { fold } from '../lib/search';
import { canonTeam } from '../lib/teams';
import { Confetti } from './Confetti';
import { MatchStatsPanel } from './MatchStatsPanel';

/** Eases a number up from 0 when it first appears — points feel earned, not printed. */
function useCountUp(target: number, active: boolean): number {
  const [v, setV] = useState(active ? 0 : target);
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 750;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return v;
}

interface Props {
  match: MatchView;
  prediction: Prediction | undefined;
  onSave: (matchId: string, home: number, away: number) => void;
  onClear: (matchId: string) => void;
  onJoker: (matchId: string, joker: boolean) => void;
  onFirstTeam: (matchId: string, side: 'HOME' | 'AWAY' | null) => void;
  onFirstScorer: (matchId: string, scorerId: string | null, scorerName: string | null) => void;
  onStatPick: (matchId: string, home: number, away: number, firstTeam: 'HOME' | 'AWAY') => void;
  squad: { id: string; name: string; position: string; team: string }[];
  saving: boolean;
}

export function MatchCard({ match, prediction, onSave, onClear, onJoker, onFirstTeam, onFirstScorer, onStatPick, squad, saving }: Props) {
  const { timeZone } = usePrefs();
  const state = matchState(match);
  const [home, setHome] = useState<string>(prediction ? String(prediction.home) : '');
  const [away, setAway] = useState<string>(prediction ? String(prediction.away) : '');
  // Predictions load async — sync the inputs when the saved prediction arrives or changes
  // (keyed on updatedAt so we don't clobber in-progress typing on unrelated re-renders).
  useEffect(() => {
    if (prediction) {
      setHome(String(prediction.home));
      setAway(String(prediction.away));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction?.updatedAt]);
  const [scorerOpen, setScorerOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statPickOpen, setStatPickOpen] = useState(false);
  // Details modal: close on Escape, and lock background scroll while open.
  useEffect(() => {
    if (!statsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStatsOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [statsOpen]);
  const [scorerQ, setScorerQ] = useState('');
  const scorerQuery = fold(scorerQ.trim());
  const scorerMatches = scorerQuery.length < 1
    ? squad // all players from both teams (home squad first, then away)
    : squad.filter((p) => fold(p.name).includes(scorerQuery));

  const editable = state === 'Open' && !match.placeholder;
  // Opt-in statistical suggestion from bookmaker odds — only fetched when the panel is opened.
  const suggestion = useQuery({
    queryKey: ['suggestion', match.id],
    queryFn: async () => (await api.matchSuggestions([match.id]))[match.id] ?? null,
    enabled: statPickOpen,
    staleTime: 10 * 60_000,
  });
  const canSave = editable && home !== '' && away !== '';
  // Whole-card click opens the details modal (only for live/finished cards, which aren't editable).
  const detailsExpandable = (state === 'Live' || state === 'Played') && !match.placeholder;
  // Within ~2h of kickoff, an upcoming card gets a Lineups button (lineups drop ~1h before).
  const toKickoffMs = new Date(match.kickoff).getTime() - Date.now();
  const preMatchSoon = !match.placeholder && (state === 'Open' || state === 'Locked') && toKickoffMs > 0 && toKickoffMs <= 2 * 60 * 60 * 1000;
  const detailsAvailable = detailsExpandable || preMatchSoon;
  // Edits not yet persisted → show a "Saving…" hint (no Save button — it auto-saves).
  const dirty = canSave && (!prediction || Number(home) !== prediction.home || Number(away) !== prediction.away);
  const awayRef = useRef<HTMLInputElement>(null);
  // Debounced auto-advance home → away, so two-digit scores (10–30) can still be typed.
  const advanceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(advanceRef.current), []);

  // Auto-save: persist the scoreline as soon as both boxes hold a valid number; auto-remove when
  // both are cleared. No Save button — score, first team, first scorer and Joker all save on change.
  const validScore = (h: number, a: number) =>
    Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0 && h <= 30 && a <= 30;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  useEffect(() => {
    if (!editable) return;
    clearTimeout(saveTimer.current);
    if (home !== '' && away !== '') {
      const h = Number(home);
      const a = Number(away);
      if (!validScore(h, a)) return;
      if (prediction && h === prediction.home && a === prediction.away) return; // unchanged
      saveTimer.current = setTimeout(() => onSave(match.id, h, a), 600);
    } else if (home === '' && away === '' && prediction) {
      saveTimer.current = setTimeout(() => onClear(match.id), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, editable, prediction?.home, prediction?.away]);

  // Flush the pending save immediately (e.g. on blur / Enter) so bonus buttons unlock sooner.
  const flushSave = () => {
    if (!editable || home === '' || away === '') return;
    const h = Number(home);
    const a = Number(away);
    if (validScore(h, a) && (!prediction || h !== prediction.home || a !== prediction.away)) {
      clearTimeout(saveTimer.current);
      onSave(match.id, h, a);
    }
  };
  const selected = prediction?.firstScorerId ? squad.find((p) => p.id === prediction.firstScorerId) : undefined;
  // Which of the two teams a squad player belongs to → its flag code.
  const codeForTeam = (team: string) => (canonTeam(team) === canonTeam(match.homeTeam) ? match.homeCode : match.awayCode);

  // Score receipt: per-rule breakdown against the final score — or the live score while in play.
  const live = state === 'Live' && match.homeScore != null && match.awayScore != null;
  const finished = state === 'Played' && match.homeScore != null && match.awayScore != null;
  const minuteLabel = state === 'Live' ? liveMinute(match) : null;
  const bd = (finished || live) && prediction
    ? scoreBreakdown({ home: prediction.home, away: prediction.away }, { home: match.homeScore!, away: match.awayScore! })
    : null;
  const actualScore = (finished || live) && match.homeScore != null && match.awayScore != null ? { home: match.homeScore, away: match.awayScore } : null;
  const goalless = !!actualScore && actualScore.home === 0 && actualScore.away === 0;
  const fg = actualScore && prediction
    ? firstGoalPoints(prediction, actualScore, { firstGoalTeam: match.firstGoalTeam, firstScorerId: match.firstScorerId })
    : null;
  // 0-0 is determinable from the score itself (no ESPN ingestion needed).
  const firstGoalKnown = match.firstGoalTeam != null || goalless;
  const firstTeamHit = !!fg && fg.firstTeam > 0;
  const firstScorerHit = !!fg && fg.firstPlayer > 0;
  const pickedTeamCode = prediction?.firstTeam === 'HOME' ? match.homeCode : match.awayCode;
  const pickedTeamName = prediction?.firstTeam === 'HOME' ? match.homeTeam : match.awayTeam;

  // Points bubble: persisted points once played; provisional "as it stands" points while live.
  const scored = state === 'Played' && !!prediction;
  const livePts = live && prediction && bd
    ? effectivePoints({ points: bd.points + (fg ? fg.firstTeam + fg.firstPlayer : 0), joker: prediction.joker })
    : null;
  const shownPts = useCountUp(scored && prediction ? effectivePoints(prediction) : livePts ?? 0, scored || livePts !== null);
  const ptsText = scored || livePts !== null ? `+${shownPts} pts` : '- pts';

  // Celebrate an exact scoreline once per match (remembered per device) — only at full time.
  const [confetti, setConfetti] = useState(false);
  const exact = finished && !!bd?.exact;
  useEffect(() => {
    if (!exact) return;
    const key = `wc2026.confetti.${match.id}`;
    let seen = false;
    try {
      seen = !!localStorage.getItem(key);
      if (!seen) localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable (private mode etc.) — celebrate once for this mount */
    }
    if (seen) return;
    setConfetti(true);
    const t = setTimeout(() => setConfetti(false), 3400);
    return () => clearTimeout(t);
  }, [exact, match.id]);

  let rcptIdx = 0;
  const rcptRow = (label: ReactNode, ok: boolean | undefined, pts: number) => (
    <div className="rcpt-row" style={{ animationDelay: `${rcptIdx++ * 70}ms` }}>
      <span className="rcpt-label">{label}</span>
      {ok === undefined ? (
        <span className="rcpt-pending muted" title="Waiting for match data">…</span>
      ) : (
        <span className={ok ? 'tick ok' : 'tick no'}>{ok ? '✓' : '✗'}</span>
      )}
      <span className="rcpt-pts">{ok ? `+${pts}` : ''}</span>
    </div>
  );

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
        ref={side === 'away' ? awayRef : undefined}
        onChange={(e) => {
          const v = e.target.value;
          set(v);
          // Flow into the away box, but debounce so a quick "12"/"30" stays in home.
          if (side === 'home') {
            clearTimeout(advanceRef.current);
            if (v !== '') advanceRef.current = setTimeout(() => awayRef.current?.focus(), 300);
          }
        }}
        onFocus={(e) => e.target.select()}
        onBlur={flushSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSave) {
            clearTimeout(advanceRef.current);
            clearTimeout(saveTimer.current);
            (e.target as HTMLInputElement).blur();
            onSave(match.id, Number(home), Number(away));
          }
        }}
        data-testid={`pred-${side}-${match.id}`}
        aria-label={`${side === 'home' ? match.homeTeam : match.awayTeam} score`}
      />
    ) : (
      <span className={`mc-box ${prediction ? 'filled' : ''}`} aria-label={`${side === 'home' ? match.homeTeam : match.awayTeam} predicted score`}>
        {prediction ? (side === 'home' ? prediction.home : prediction.away) : '–'}
      </span>
    );

  return (
    <div
      className={`match-card ${prediction?.joker ? 'joker-on' : ''}${detailsExpandable ? ' expandable' : ''}`}
      onClick={detailsExpandable ? () => setStatsOpen(true) : undefined}
      data-testid={`match-${match.id}`}
    >
      {confetti && <Confetti />}
      <div className="mc-header">
        <span className="mc-round">{stageLabel(match.stage, match.groupName)}</span>
        <StatusBadge state={state} />
      </div>

      <div className="mc-body">
        <div className="mc-meta">{formatKickoff(match.kickoff, timeZone)}</div>

        {!editable && !match.placeholder && (
          <div className="mc-pred-cap" data-testid={`pred-cap-${match.id}`}>{prediction ? 'Your pick' : 'No prediction'}</div>
        )}
        <div className={`mc-pred${!editable && !match.placeholder ? ' is-prediction' : ''}`}>
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
            <span className="live-dot">●</span> LIVE
            {minuteLabel && <span className="mc-min" data-testid={`minute-${match.id}`}> {minuteLabel}</span>}
            {' '}<strong>{match.homeScore ?? 0}–{match.awayScore ?? 0}</strong>
          </div>
        )}
        {state === 'Played' && (
          <div className="mc-result" data-testid={`ft-${match.id}`}>
            FT <strong>{match.homeScore}–{match.awayScore}</strong>
          </div>
        )}
        {match.placeholder && <div className="mc-result muted">Teams not decided yet</div>}

        {!editable && !match.placeholder && prediction && (
          bd ? (
            <div className="mc-receipt" data-testid={`receipt-${match.id}`}>
              <div className="mc-divider" />
              {rcptRow('Result', bd.outcome, SCORE_POINTS.outcome)}
              {rcptRow('Goal difference', bd.goalDiff, SCORE_POINTS.goalDiff)}
              {rcptRow('Exact score', bd.exact, SCORE_POINTS.exact)}
              {rcptRow(`${match.homeCode ?? 'Home'} goals`, bd.home, SCORE_POINTS.home)}
              {rcptRow(`${match.awayCode ?? 'Away'} goals`, bd.away, SCORE_POINTS.away)}
              {(prediction.firstTeam || (goalless && firstTeamHit)) && rcptRow(
                goalless ? <>1st to score: <em>none (0-0)</em></> : <>1st to score: <Flag code={pickedTeamCode} name={pickedTeamName} /></>,
                firstGoalKnown ? firstTeamHit : undefined,
                FIRST_TEAM_POINTS,
              )}
              {(prediction.firstScorerId || (goalless && firstScorerHit)) && rcptRow(
                goalless ? <>1st scorer: <em>none (0-0)</em></> : <>1st scorer: {prediction.firstScorerName}</>,
                firstGoalKnown ? firstScorerHit : undefined,
                FIRST_PLAYER_POINTS,
              )}
              {prediction.joker && (
                <div className="rcpt-row rcpt-joker" style={{ animationDelay: `${rcptIdx * 70}ms` }}>
                  <span className="rcpt-label">★ Joker</span>
                  <span className="tick ok">✓</span>
                  <span className="rcpt-pts">×2</span>
                </div>
              )}
            </div>
          ) : (
            (prediction.firstTeam || prediction.firstScorerName || prediction.joker) ? (
              <div className="mc-receipt" data-testid={`locked-picks-${match.id}`}>
                <div className="mc-divider" />
                <div className="mc-yourpicks muted fine">
                  Locked in:
                  {prediction.firstTeam && <> 1st to score <Flag code={pickedTeamCode} name={pickedTeamName} /></>}
                  {prediction.firstScorerName && <> · ⚽ {prediction.firstScorerName}</>}
                  {prediction.joker && <> · ★ Joker ×2</>}
                </div>
              </div>
            ) : null
          )
        )}

        {detailsAvailable && (
          <div className="mc-stats-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mc-stats-toggle"
              onClick={() => setStatsOpen(true)}
              data-testid={`stats-toggle-${match.id}`}
            >
              {preMatchSoon ? '👥 Lineups ›' : '📊 Match details ›'}
            </button>
          </div>
        )}

        {!match.placeholder && (
          <div className="mc-stats-wrap" onClick={(e) => e.stopPropagation()}>
            <Link className="mc-stats-toggle" to={`/predictions/${match.id}`} data-testid={`who-picked-${match.id}`}>
              Who picked what ›
            </Link>
          </div>
        )}

        {editable && (
          <div className="mc-statpick">
            <button
              type="button"
              className="statpick-toggle"
              onClick={() => setStatPickOpen((o) => !o)}
              aria-expanded={statPickOpen}
              data-testid={`statpick-${match.id}`}
            >
              ✨ Stat pick <span className={`chev ${statPickOpen ? 'up' : ''}`} aria-hidden>▾</span>
            </button>
            {statPickOpen && (
              <div className="statpick-panel">
                {suggestion.isLoading ? (
                  <span className="muted fine">Crunching the odds…</span>
                ) : !suggestion.data ? (
                  <span className="muted fine">No odds available for this match yet.</span>
                ) : (
                  <>
                    <div className="statpick-chips">
                      {suggestion.data.scores.map((s, i) => (
                        <button
                          key={`${s.home}-${s.away}`}
                          type="button"
                          className={`statpick-chip${i === 0 ? ' top' : ''}`}
                          onClick={() => { onStatPick(match.id, s.home, s.away, suggestion.data!.firstTeam); setStatPickOpen(false); }}
                          data-testid={`statpick-chip-${match.id}-${i}`}
                        >
                          {s.home}–{s.away}
                          <span className="sp-pct">{Math.round(s.prob * 100)}%</span>
                        </button>
                      ))}
                    </div>
                    <div className="statpick-meta muted fine">
                      1st to score:{' '}
                      <Flag
                        code={suggestion.data.firstTeam === 'HOME' ? match.homeCode : match.awayCode}
                        name={suggestion.data.firstTeam === 'HOME' ? match.homeTeam : match.awayTeam}
                      />{' '}· tap to use
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {editable && (
          <div className="mc-bonus">
            <div className="mc-divider" />
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

            <div className="mc-divider" />
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
                <>
                  {selected ? <Flag code={codeForTeam(selected.team)} name={selected.team} /> : null}
                  {prediction.firstScorerName}{selected?.position ? <span className="pos"> · {selected.position}</span> : null}
                </>
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
                            <Flag code={codeForTeam(p.team)} name={p.team} />
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
        <span
          className={`pts-bubble ${livePts !== null ? 'live' : ''} ${ptsText === '–' ? 'empty' : ''}`}
          title={livePts !== null ? 'Live points if the score stays like this' : 'Points'}
          data-testid={`pts-${match.id}`}
        >
          {ptsText}
        </span>
        <div className="mc-foot-right">
          {editable && (
            dirty ? (
              <span className="mc-savestate saving" data-testid={`savestate-${match.id}`}>Saving…</span>
            ) : prediction && home !== '' && away !== '' ? (
              <span className="mc-savestate saved" data-testid={`savestate-${match.id}`}>Saved ✓</span>
            ) : null
          )}
        </div>
      </div>

      {statsOpen && createPortal(
        <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); setStatsOpen(false); }}>
          <div className="modal match-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Match details" data-testid={`match-modal-${match.id}`}>
            <div className="modal-head">
              <h3 className="mm-title">
                <Flag code={match.homeCode} name={match.homeTeam} /> {match.homeCode ?? 'Home'}
                <span className="mm-score">{state === 'Live' || state === 'Played' ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}` : 'v'}</span>
                {match.awayCode ?? 'Away'} <Flag code={match.awayCode} name={match.awayTeam} />
              </h3>
              <button className="modal-close" onClick={() => setStatsOpen(false)} aria-label="Close">✕</button>
            </div>
            <MatchStatsPanel match={match} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
