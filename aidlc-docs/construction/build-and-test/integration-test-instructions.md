# Integration Test Instructions

## Purpose
Validate cross-module and request-level behavior across the Express API, shared domain logic, repositories, and frontend API assumptions.

## Current Automated Integration Coverage

### Auth and Session Flow
- Login/sign-up by unique name plus 4-digit PIN.
- Resume with the same PIN.
- Reject wrong PIN.
- Require bearer token on protected routes.

Command:
```bash
npm run test --workspace @wc2026/api
```

### Prediction Flow
- Accept predictions before kickoff.
- Reject predictions after kickoff.
- Reject invalid score ranges.
- Return the caller's saved predictions.

Command:
```bash
npm run test --workspace @wc2026/api
```

### Group and Leaderboard Flow
- Create groups.
- Join via invite code.
- Rank members by scoring totals and tie-breakers.
- Forbid non-members from reading a private group leaderboard.
- Allow creator-only group deletion.
- Allow non-creators to leave a group.

Command:
```bash
npm run test --workspace @wc2026/api
```

### Football API Client Mapping
- Map upstream football-data.org fixtures/results into local match records.
- Surface a clear config error when the football-data.org token is missing.

Command:
```bash
npm run test --workspace @wc2026/api
```

## Optional Local Runtime Integration

Start the API in memory mode:
```bash
PERSISTENCE=memory SESSION_SIGNING_SECRET=local-dev-secret FOOTBALL_DATA_TOKEN=<token> npm run start --workspace @wc2026/api
```

Start the web app:
```bash
npm run dev --workspace @wc2026/web
```

Then exercise:
- Login/sign-up.
- Create group.
- Add predictions.
- View fixtures and leaderboard.
- Change PIN in settings.
- Delete or leave a group.

## Cleanup
Stop local processes with Ctrl-C. If using DynamoDB Local, stop it with:
```bash
docker compose -f api/docker-compose.yml down
```
