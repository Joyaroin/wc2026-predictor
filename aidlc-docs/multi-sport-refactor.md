# Multi-Sport Refactor — `SportProvider` (sketch)

Status: **proposal / sketch** (branch `sketch/multi-sport-provider`). Nothing here is wired into the running app yet. The goal is to turn the World Cup predictor into a platform that also serves **tennis, basketball, hockey, baseball, and American football**, with minimal change to the core.

## Why this is a small change
The codebase is already set up for it (good dependency injection by the original author):

- `api/src/integration/footballApiClient.ts` — `interface FootballApiClient { fetchCompetitionMatches(): Promise<Match[]> }` plus a **pure** `mapToDomain(ProviderMatch): Match` translator (an anti-corruption layer).
- `api/src/services/sync.ts` — `createSyncService(footballApi, …)` depends **only on that interface**, never on football-data.org directly.
- `api/src/bootstrap.ts:25` — the single wiring point: `createFootballApiClient(config, logger)`.

So `sync`, `scoring`, leaderboards, notifications, and the **Rabbi Tarek** assistant are *already* sport-agnostic — they consume the domain `Match`, not the provider. Only the integration file is coupled.

## The target shape
`api/src/integration/sportProvider.ts` (added in this branch, additive/non-wired):

```ts
interface SportProvider {
  readonly sport: Sport;
  readonly providerId: string;
  fetchMatches(): Promise<Match[]>;
}
```

`footballDataProvider` wraps the existing `createFootballApiClient` unchanged — proving the migration is a **rename + indirection**, not a rewrite.

## Migration steps (when promoted from sketch)
1. Have `sync.ts` depend on `SportProvider` instead of `FootballApiClient` (structurally identical — just the type name).
2. In `bootstrap.ts`, replace the hard `createFootballApiClient(...)` with `resolveSportProvider(sport, providerId, config, logger)`, reading `SPORT` + `DATA_PROVIDER` from config.
3. Add adapters one per provider, each owning its own `mapToDomain`:
   - `theSportsDbProvider` — best **free** multi-sport source (~30 req/min, many sports).
   - `balldontlieProvider` — 20+ leagues; **free tier is one sport only**, paid for multi.
   - `espnProvider` — free + broad but **unofficial** (good as a fallback / prototyping).
   - tennis → a dedicated provider (Matchstat / SteveG); tennis fragments from the others.
4. Per-sport config: today `config.competition` defaults to `'WC'` (`FOOTBALL_COMPETITION`); generalize to a `{ sport, providerId, competition/league }` triple.

## Domain coupling to resolve (the real work, not the plumbing)
The `Match`/`Stage` model in `packages/shared/src/types.ts` is football-tournament-shaped:

- `Stage = 'GROUP_STAGE' | 'LAST_16' | … | 'FINAL'` — tournament-specific. Other sports need a generic `round` / `phase` (regular season + playoffs), or a per-sport `Stage` union.
- `Outcome = 'HOME' | 'DRAW' | 'AWAY'` — **basketball/baseball/tennis have no draw**; soccer/hockey do. Make "draw allowed" a per-sport trait.
- `groupName` ('A'..'L') and `matchday` are World-Cup concepts — make nullable/optional per sport (already nullable).

These are domain-design decisions, not adapter work — do them deliberately before adding the first non-football sport.

## What stays the moat
Generic multi-sport pick'em is crowded. The differentiator is **Rabbi Tarek generalized into a per-sport grounded AI sidekick** (an NBA "Tarek", a tennis "Tarek"), which the prediction core already supports. See the wiki: `concepts/sports-data-adapter-pattern`, `synthesis/multi-sport-prediction-platform`.
