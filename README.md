# WC2026 Predictor

A FIFA-style score prediction game for the 2026 FIFA World Cup. Players self-identify by name (no accounts), create/join friend groups via an invite code, predict exact scorelines for every match, and compete on per-group leaderboards. Predictions lock at kickoff and are scored against live results.

Built with the **AWS AI-DLC** workflow — see `aidlc-docs/` for the full requirements, stories, design, and audit trail.

## Monorepo layout
```
packages/shared/   # domain types, zod schemas, pure scoring engine (+ PBT tests)
api/               # backend: Express REST API (Lambda-adaptable) + sync job   (built in a later unit)
web/               # React SPA (Vite + TanStack Query)                          (built in a later unit)
infra/             # Terraform + k3s-on-EC2 + Helm + ArgoCD GitOps
```

## Scoring
| Result | Points |
|---|---|
| Exact score | 5 |
| Correct goal difference (right outcome) | 3 |
| Correct result only (W/D/L) | 2 |
| Wrong | 0 |

Leaderboard tie-break: total points → most exact scores → most correct results → name (A–Z).

## Develop
```bash
nvm use            # Node 22
npm install
npm test           # runs all workspace tests
```

## Status
AI-DLC Build and Test is complete. The app is ready for the Operations/deployment phase once AWS deployment variables are supplied.
