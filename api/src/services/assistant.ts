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
  ask(playerId: string, message: string, history: AssistantTurn[], research?: boolean): Promise<{ reply: string }>;
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

  // Simple in-memory rate limits (per pod — fine for this scale).
  const hits = new Map<string, number[]>();
  const researchHits = new Map<string, number[]>();
  const LIMIT = 20; // all messages / hour / player
  const RESEARCH_LIMIT = 8; // web-research messages / hour / player (each can run a few searches — keeps cost down)
  const WINDOW = 60 * 60 * 1000;
  const take = (map: Map<string, number[]>, key: string, limit: number, now: number): boolean => {
    const recent = (map.get(key) ?? []).filter((t) => now - t < WINDOW);
    if (recent.length >= limit) return false;
    recent.push(now);
    map.set(key, recent);
    return true;
  };

  return {
    enabled: () => enabled,

    async ask(playerId, message, history, research = false) {
      if (!client) throw new AppError(503, 'The assistant is not available right now.', 'assistant_disabled');
      const text = message.trim();
      if (!text) throw new ValidationError('Message is empty.');
      if (text.length > 1000) throw new ValidationError('Message is too long (max 1000 characters).');

      const now = clock.now().getTime();
      if (!take(hits, playerId, LIMIT, now)) throw new AppError(429, "You've hit the assistant limit for now — try again in a bit.", 'assistant_rate_limited');
      if (research && !take(researchHits, playerId, RESEARCH_LIMIT, now)) {
        throw new AppError(429, "You've used up web research for now — try again later (regular questions still work).", 'research_rate_limited');
      }

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
        .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content.slice(0, 2000) }));

      const system = [
        { type: 'text' as const, text: SYSTEM },
        ...(research
          ? [{ type: 'text' as const, text: `Web research is ON for this message. HARD RULE: you may ONLY search the web for football / FIFA World Cup 2026 topics — teams, players, managers, fixtures, results, form, injuries, transfers, standings, history. If the user asks you to research anything outside football, DO NOT run a web search: politely refuse in one line and steer back to the World Cup. When you do search, keep it minimal, answer concisely, and mention where it came from.` }]
          : []),
        { type: 'text' as const, text: `Current context (live data for this user):\n${context}` },
      ];

      const extractText = (content: Anthropic.ContentBlock[]): string =>
        content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim();

      try {
        if (research) {
          // Opt-in web research: cap searches (max_uses) and the server-side loop to keep cost predictable.
          const messages: Anthropic.MessageParam[] = [...turns, { role: 'user', content: text }];
          let reply = '';
          for (let i = 0; i < 4; i++) {
            const msg = await client.messages.create({
              model: config.assistantResearchModel,
              max_tokens: 1024,
              system,
              messages,
              tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
            });
            reply = extractText(msg.content);
            if (msg.stop_reason !== 'pause_turn') break;
            messages.push({ role: 'assistant', content: msg.content }); // resume the server tool loop
          }
          return { reply: reply || "I couldn't find anything useful on that — try rephrasing?" };
        }

        const msg = await client.messages.create({
          model: config.assistantModel,
          max_tokens: 1024,
          system,
          messages: [...turns, { role: 'user', content: text }],
        });
        return { reply: extractText(msg.content) || "Hmm, I didn't catch that — mind rephrasing?" };
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) throw new AppError(429, 'The assistant is busy — try again in a moment.', 'assistant_busy');
        logger.error('assistant call failed', { error: (err as Error).message });
        throw new AppError(502, "The assistant couldn't answer just now. Try again shortly.", 'assistant_failed');
      }
    },
  };
}
