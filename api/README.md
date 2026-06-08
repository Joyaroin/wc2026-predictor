# @wc2026/api

Backend REST API for the WC2026 Predictor — Express (TypeScript), runs locally and on AWS Lambda (via `@codegenie/serverless-express`). Persists to DynamoDB.

## Run locally
```bash
cp .env.example .env          # then edit values
docker compose up -d          # DynamoDB Local on :8000
npm run create-table          # create the single table
npm run dev                   # API on http://localhost:4000
```
To run without Docker, set `PERSISTENCE=memory` in `.env` (data is lost on restart).

## Auth model
No email/accounts. `POST /api/auth/login { name, pin }` signs up (first use of a name) or resumes (same name + 4-digit PIN), returning a signed session **token**. Send it as `Authorization: Bearer <token>` on every other call. PIN is stored only as a scrypt hash.

## Key endpoints
- `POST /api/auth/login` — login/signup → `{ playerId, name, token }`
- `GET /api/matches` — fixtures (with `locked` flag)
- `PUT /api/predictions/:matchId` — upsert a scoreline (rejected after kickoff)
- `POST /api/groups` / `POST /api/groups/join` — create / join via invite code
- `GET /api/groups/:id/leaderboard` — ranked standings

## Sync
`src/sync.lambda.ts` pulls fixtures/results from football-data.org (`FOOTBALL_DATA_TOKEN`) every 10 min (scheduled by `infra`) and precomputes points.

## Test
```bash
npm test --workspace @wc2026/api
```
Unit + property-based (fast-check) + supertest integration tests (using in-memory repositories — no Docker needed).
