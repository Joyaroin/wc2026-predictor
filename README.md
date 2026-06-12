# WC2026 Predictor

A FIFA-style score-prediction game for the **2026 FIFA World Cup** (48 teams, 104 matches). Pick a name + 4-digit PIN (no email, resumes across devices), create or join friend groups via an invite code, predict every fixture, make pre-tournament award picks, and climb the per-group and global leaderboards. Predictions lock at kickoff and are scored automatically against live results.

- **Prod:** https://wc-predictions-2026.com
- **Dev:** https://dev.wc-predictions-2026.com

Built with the **AWS AI-DLC** workflow — see `aidlc-docs/` for the requirements, stories, design, and audit trail.

## Gameplay

- **Identity:** just a name + 4-digit PIN (scrypt-hashed). No accounts/email; log back in from any device.
- **Groups:** create a group (you get an invite code) or join one; the creator can delete it. Each group has its own leaderboard, plus a **global** leaderboard across everyone.
- **Predictions:** enter a scoreline for every match, organised into collapsible **match-week** sections. Optionally also predict the **first team to score** and the **first goalscorer**.
- **Joker:** flag one match per match-week to **double** its points.
- **Awards:** four pre-tournament picks (lock 13 June, 14:00 ET) that add to your totals.

## Scoring

Each match prediction is **additive** — components stack, up to **20** for a perfect prediction:

| Component | Points |
|---|---|
| Correct outcome (W/D/L) | +2 |
| Correct goal difference | +3 |
| Exact final scoreline | +3 |
| Team 1 exact goals | +2 |
| Team 2 exact goals | +2 |
| First team to score | +2 |
| First goalscorer | +6 |

A **Joker** doubles a match's total. Leaderboard tie-break: total points → most exact scores → most scoring predictions → name (A–Z).

### Awards (one-time bonuses)

| Award | Bonus | Scored from |
|---|---|---|
| ⭐ Player of the Tournament | +25 | admin-set winner (no free data source) |
| 🥇 Golden Boot | +15 | tournament top scorer (ESPN) |
| 🏆 Tournament Winner | +10 | the final's winner |
| 🐴 Dark Horse | +20 / +10 / +5 | pick a team; score = title-odds × deepest round reached — **lowest wins** (a long shot that goes far). Top-3 placements pay out |

## Live data

- **Match fixtures, status, scores & winners:** [football-data.org](https://www.football-data.org) (free tier, competition `WC`).
- **Squads, top scorer, first goals & goalscorers, player positions:** ESPN's public API — **no key required**.

A sync job (Kubernetes CronJob) refreshes results, re-scores predictions, updates the Golden Boot leader, recomputes Dark Horse placements, and ingests first-goal facts.

## Tech stack

```
packages/shared/   Domain types, zod schemas, pure scoring & awards engine (+ property-based tests)
api/               Express 5 REST API (Lambda-adaptable via serverless-express),
                   DynamoDB single-table store, scrypt PIN + HMAC session tokens,
                   football-data + ESPN integrations, sync job
web/               React 19 SPA — Vite + TanStack Query + React Router
infra/             Terraform + k3s-on-EC2 (Graviton) + Helm + ArgoCD GitOps, cert-manager/Let's Encrypt
```

## Develop

```bash
nvm use            # Node 22
npm install
npm test           # all workspace tests (shared / api / web)
npm run build      # typecheck all workspaces
```

Run locally (no AWS needed — in-memory store):

```bash
# API on :4000 — set PERSISTENCE=memory, SESSION_SIGNING_SECRET, ALLOWED_ORIGIN in api/.env
#   (see api/.env.example; add FOOTBALL_DATA_TOKEN to pull real fixtures, ADMIN_TOKEN to enable admin actions)
npm run dev --workspace @wc2026/api

# Web on :5173 (Vite)
npm run dev --workspace @wc2026/web
```

## Deploy

GitOps on a single k3s EC2 node with ArgoCD. Every push to `main` builds commit-pinned images and **auto-deploys to dev** (hands-off); production is promoted via an approval-gated workflow to the `release` branch. HTTPS via cert-manager + Let's Encrypt; DynamoDB accessed through the EC2 instance role (no static keys). See `infra/README.md`.
