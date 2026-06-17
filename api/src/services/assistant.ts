// In-app AI assistant — a grounded WC Predictions sidekick (Claude Haiku via the Anthropic SDK).
// Disabled (graceful no-op) when no ANTHROPIC_API_KEY is configured.
import Anthropic from '@anthropic-ai/sdk';
import type { Match } from '@wc2026/shared';
import type { Config } from '../lib/config';
import type { Clock } from '../lib/clock';
import type { Logger } from '../lib/logger';
import type { MatchService } from './matches';
import type { LeaderboardService } from './leaderboard';
import type { PredictionService } from './predictions';
import { AppError, ValidationError } from '../lib/errors';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}
export interface AssistantService {
  enabled(): boolean;
  ask(playerId: string, message: string, history: AssistantTurn[]): Promise<{ reply: string }>;
}

const SYSTEM = `You are Rabbi Tarek — a friendly, witty sidekick inside a 2026 FIFA World Cup score-prediction game. Players predict match scorelines and compete on leaderboards. Introduce yourself as Rabbi Tarek if asked who you are.

Scoring (per match, additive, max 20):
- Correct outcome (win/draw/loss): +5
- Correct goal difference: +3
- Each team's exact goals: +2 each
- Exact scoreline: +5 bonus (so a perfect score = 5+3+2+2+5 = up to 17 from the scoreline, plus bonuses below)
- First team to score: +2
- First goalscorer (player): +6
- Joker: one match per matchday/round can be flagged as a Joker, which DOUBLES that match's points.
There are also season-long Awards (Golden Boot, Dark Horse, tournament winner, player of the tournament) that pay out at the end.

How to behave:
- Keep it short — usually one or two sentences, with a light touch of football banter. Get to the point; skip preamble and don't over-explain. Use the user's data below when relevant.
- For "who should I pick?" questions, you may suggest a scoreline using your football knowledge and any model/odds context provided, but ALWAYS frame it as for-fun guidance, never betting advice, and remind them it's their call.
- Answer rules and "why did I get X points" questions using the scoring above.
- You can't change predictions or take actions — tell users to tap the match card to edit. Don't invent data you weren't given.
- Keep it light. No medical, legal, financial or gambling advice.`;

function fmtKick(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ') + 'Z';
}
function score(m: Match): string {
  return m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : 'vs';
}

/** Build a compact, per-request context block grounding the model in this player's situation. */
function buildContext(
  playerName: string,
  rank: number | null,
  points: number | null,
  total: number,
  matches: Match[],
  predicted: Map<string, { home: number; away: number; joker?: boolean }>,
  now: number,
): string {
  const lines: string[] = [];
  lines.push(`Player: ${playerName}${rank != null ? ` — global rank ${rank} of ${total}, ${points} pts` : ''}.`);

  const upcoming = matches
    .filter((m) => !m.placeholder && new Date(m.kickoff).getTime() > now && (m.status === 'SCHEDULED' || m.status === 'TIMED'))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(0, 8);
  if (upcoming.length) {
    lines.push('Upcoming matches (and your pick):');
    for (const m of upcoming) {
      const p = predicted.get(m.id);
      const pick = p ? `you picked ${p.home}-${p.away}${p.joker ? ' (JOKER)' : ''}` : 'no pick yet';
      lines.push(`- ${m.homeTeam} vs ${m.awayTeam} — ${fmtKick(m.kickoff)}${m.groupName ? `, Group ${m.groupName}` : ''} — ${pick}`);
    }
  }

  const live = matches.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  if (live.length) {
    lines.push('Live now:');
    for (const m of live.slice(0, 5)) lines.push(`- ${m.homeTeam} ${score(m)} ${m.awayTeam} (live)`);
  }

  const recent = matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 5);
  if (recent.length) {
    lines.push('Recent results:');
    for (const m of recent) lines.push(`- ${m.homeTeam} ${score(m)} ${m.awayTeam}`);
  }

  return lines.join('\n');
}

export function createAssistantService(
  config: Config,
  matchSvc: MatchService,
  leaderboard: LeaderboardService,
  predictions: PredictionService,
  clock: Clock,
  logger: Logger,
): AssistantService {
  const enabled = config.anthropicApiKey.length > 0;
  const client = enabled ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

  // Simple in-memory rate limit: 20 messages / hour / player (per pod — fine for this scale).
  const hits = new Map<string, number[]>();
  const LIMIT = 20;
  const WINDOW = 60 * 60 * 1000;

  return {
    enabled: () => enabled,

    async ask(playerId, message, history) {
      if (!client) throw new AppError(503, 'The assistant is not available right now.', 'assistant_disabled');
      const text = message.trim();
      if (!text) throw new ValidationError('Message is empty.');
      if (text.length > 1000) throw new ValidationError('Message is too long (max 1000 characters).');

      const now = clock.now().getTime();
      const recent = (hits.get(playerId) ?? []).filter((t) => now - t < WINDOW);
      if (recent.length >= LIMIT) throw new AppError(429, "You've hit the assistant limit for now — try again in a bit.", 'assistant_rate_limited');
      recent.push(now);
      hits.set(playerId, recent);

      let context = '';
      try {
        const [matches, global, mine] = await Promise.all([
          matchSvc.list(),
          leaderboard.getGlobal(playerId),
          predictions.getMine(playerId),
        ]);
        const predMap = new Map(mine.map((p) => [p.matchId, { home: p.home, away: p.away, joker: p.joker }]));
        context = buildContext(global.me?.name ?? 'there', global.me?.rank ?? null, global.me?.points ?? null, global.total, matches, predMap, now);
      } catch (err) {
        logger.warn('assistant context build failed', { error: (err as Error).message });
      }

      const turns = history
        .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
        .slice(-10)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));

      try {
        const msg = await client.messages.create({
          model: config.assistantModel,
          max_tokens: 1024,
          system: [
            { type: 'text', text: SYSTEM },
            { type: 'text', text: `Current context (live data for this user):\n${context}` },
          ],
          messages: [...turns, { role: 'user', content: text }],
        });
        const reply = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
          .trim();
        return { reply: reply || "Hmm, I didn't catch that — mind rephrasing?" };
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) throw new AppError(429, 'The assistant is busy — try again in a moment.', 'assistant_busy');
        logger.error('assistant call failed', { error: (err as Error).message });
        throw new AppError(502, "The assistant couldn't answer just now. Try again shortly.", 'assistant_failed');
      }
    },
  };
}
