# @wc2026/web

React + TypeScript single-page app for the WC2026 Predictor (Vite, TanStack Query, React Router).

## Run locally
```bash
cp .env.example .env     # set VITE_API_URL (default http://localhost:4000)
npm run dev              # http://localhost:5173
```
The backend must be running and its `ALLOWED_ORIGIN` must include this origin.

## Pages
- **Landing** — name + 4-digit PIN login/resume
- **Fixtures** — matches by stage, inline scoreline predictions (locks at kickoff)
- **Groups / Group detail** — create/join via invite code, leaderboard
- **Match detail** — everyone's picks (after kickoff) vs the result
- **My points** — per-match breakdown + total

## Build / test
```bash
npm run build            # tsc typecheck + vite production build
npm test                 # vitest (pure format helpers)
```

Auth: the session token from `POST /api/auth/login` is stored in `localStorage` and sent as a Bearer header by the API client. Interactive elements expose stable `data-testid` attributes for automation.
