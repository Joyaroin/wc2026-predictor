import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SCORE_POINTS, FIRST_TEAM_POINTS, FIRST_PLAYER_POINTS } from '@wc2026/shared';
import { api, type BreakdownRow, type MatchView, type PointsBreakdown } from '../api/client';
import { Flag } from './Flag';
import { Avatar } from './Avatar';

function ReceiptRow({ label, ok, pts }: { label: ReactNode; ok: boolean | null; pts: number }) {
  return (
    <div className="rcpt-row">
      <span className="rcpt-label">{label}</span>
      {ok === null ? (
        <span className="rcpt-pending muted" title="Waiting for match data">…</span>
      ) : (
        <span className={ok ? 'tick ok' : 'tick no'}>{ok ? '✓' : '✗'}</span>
      )}
      <span className="rcpt-pts">{ok ? `+${pts}` : ''}</span>
    </div>
  );
}

function Receipt({ bd, m }: { bd: PointsBreakdown; m: MatchView | undefined }) {
  return (
    <div className="mr-breakdown">
      <ReceiptRow label="Result" ok={bd.outcome} pts={SCORE_POINTS.outcome} />
      <ReceiptRow label="Goal difference" ok={bd.goalDiff} pts={SCORE_POINTS.goalDiff} />
      <ReceiptRow label="Exact score" ok={bd.exact} pts={SCORE_POINTS.exact} />
      <ReceiptRow label={`${m?.homeCode ?? 'Home'} goals`} ok={bd.home} pts={SCORE_POINTS.home} />
      <ReceiptRow label={`${m?.awayCode ?? 'Away'} goals`} ok={bd.away} pts={SCORE_POINTS.away} />
      {bd.firstTeam && (
        <ReceiptRow
          label={<>1st to score: <Flag code={bd.firstTeam.picked === 'HOME' ? m?.homeCode ?? null : m?.awayCode ?? null} name={bd.firstTeam.picked === 'HOME' ? m?.homeTeam ?? '' : m?.awayTeam ?? ''} /></>}
          ok={bd.firstTeam.hit}
          pts={FIRST_TEAM_POINTS}
        />
      )}
      {bd.firstScorer && (
        <ReceiptRow label={<>1st scorer: {bd.firstScorer.name}</>} ok={bd.firstScorer.hit} pts={FIRST_PLAYER_POINTS} />
      )}
      {bd.joker && (
        <div className="rcpt-row rcpt-joker">
          <span className="rcpt-label">★ Joker</span>
          <span className="tick ok">✓</span>
          <span className="rcpt-pts">×2</span>
        </div>
      )}
    </div>
  );
}

/** A player's picks vs results (read-only). Tap a played row to see its points breakdown. */
export function PlayerResults({ name, rows, total, awardPoints = 0, loading, color }: { name: string; rows: BreakdownRow[]; total: number; awardPoints?: number; loading?: boolean; color?: string | null }) {
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const matchById = useMemo(
    () => new Map((matches.data ?? []).map((m) => [m.id, m])),
    [matches.data],
  );

  const sorted = useMemo(
    () => rows.slice().sort((a, b) => (matchById.get(b.matchId)?.kickoff ?? '').localeCompare(matchById.get(a.matchId)?.kickoff ?? '')),
    [rows, matchById],
  );

  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <div className="member-head">
        <Avatar name={name} size={40} ring color={color} />
        <h2>{name}</h2>
        {/* Authoritative leaderboard total: joker-adjusted match points + bracket/award bonus. */}
        <span className="member-total">{total} pts</span>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && sorted.length === 0 && <p className="muted">No predictions yet.</p>}
      {awardPoints > 0 && (
        <p className="mr-awards muted fine" data-testid="award-points">
          + {awardPoints} pts from bracket &amp; awards (included in your total)
        </p>
      )}

      <div className="member-results">
        {sorted.map((r) => {
          const m = matchById.get(r.matchId);
          const hidden = r.home == null;
          const played = m?.homeScore != null && m?.awayScore != null;
          const expandable = !!r.breakdown;
          const isOpen = open === r.matchId;
          return (
            <div className="mr-item" key={r.matchId}>
              <button
                type="button"
                className={`mr-row${expandable ? ' expandable' : ''}`}
                onClick={() => expandable && setOpen(isOpen ? null : r.matchId)}
                aria-expanded={expandable ? isOpen : undefined}
                data-testid={`mr-row-${r.matchId}`}
              >
                <span className="mr-teams">
                  <Flag code={m?.homeCode ?? null} name={m?.homeTeam ?? ''} />
                  <b>{m?.homeCode ?? '?'}</b>
                  <span className="muted">v</span>
                  <b>{m?.awayCode ?? '?'}</b>
                  <Flag code={m?.awayCode ?? null} name={m?.awayTeam ?? ''} />
                </span>
                <span className="mr-pick">{hidden ? <span className="muted">🔒 hidden</span> : `${r.home}–${r.away}`}</span>
                <span className="mr-actual muted">{played ? `${m!.homeScore}–${m!.awayScore}` : '·'}</span>
                <span className={`mr-pts${r.points > 0 ? ' got' : ''}`}>{r.points > 0 ? `+${r.points}` : played ? '0' : ''}</span>
                {expandable && <span className={`mr-chev${isOpen ? ' up' : ''}`} aria-hidden>▾</span>}
              </button>
              {isOpen && r.breakdown && <Receipt bd={r.breakdown} m={m} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
