# Code Generation Plan — Unit `web`

**Unit dir**: `web/`. **Position**: 3rd. **Depends on**: `@wc2026/shared` (types) + backend HTTP contract.
**Stack**: Vite + React 18 + TypeScript + TanStack Query + React Router (decisions: REST, TS, TanStack Query). Mobile-first CSS.
Code → `web/` (never aidlc-docs/). Summary → `aidlc-docs/construction/web/code/`.

---

## Steps

### Step 1 — Scaffold [x]
`web/package.json` (pinned: react, react-dom, @tanstack/react-query, react-router-dom; dev: vite, @vitejs/plugin-react, typescript, vitest, jsdom, @testing-library/react, types). `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example` (`VITE_API_URL`). Add `web` to root workspaces.

### Step 2 — API client + types [x]
`src/api/client.ts` — typed fetch wrapper using `@wc2026/shared` DTOs; attaches `Authorization: Bearer <token>`; throws typed `ApiError`. Endpoints: login, me, groups (create/join/list/get/members/leaderboard/breakdown), matches, predictions (list/upsert), match predictions.

### Step 3 — Player context + query provider [x]
`src/context/PlayerContext.tsx` — persist `{ playerId, name, token }` in localStorage; `usePlayer()`. `src/main.tsx` wires QueryClientProvider + Router + PlayerProvider.

### Step 4 — Reusable components [x]
`StatusBadge` (open/locked/played), `ScoreInput`, `MatchCard` (shows teams, kickoff local time, prediction input or locked view, points), `LeaderboardTable`, `Nav`. All interactive elements get stable `data-testid`.

### Step 5 — Pages [x]
- `LandingPage` — name + 4-digit PIN login/signup (US-1.1/1.2)
- `GroupsPage` — list/create/join via code (US-2.1/2.2/2.3)
- `GroupDetailPage` — leaderboard + members (US-2.4/5.3/5.4)
- `FixturesPage` — matches by stage/date, inline predictions (US-3.x/4.x)
- `MatchDetailPage` — everyone's picks post-lock + result (US-6.x)
- `MyBreakdownPage` — per-match points + total (US-5.5)

### Step 6 — App shell + routing + styles [x]
`App.tsx` (routes, auth guard → redirect to Landing when no token), `src/styles.css` (mobile-first, FIFA-ish theme).

### Step 7 — Minimal test [x]
`src/lib/format.ts` (pure helpers: kickoff→local, match status label, points→label) + `test/format.test.ts` (vitest). Keeps web verifiable without a full DOM harness.

### Step 8 — Docs [x]
`web/README.md` + `aidlc-docs/construction/web/code/web-summary.md`.

---

## Story traceability
- [x] US-1.x login · [x] US-2.x groups · [x] US-3.x fixtures · [x] US-4.x predictions · [x] US-5.x leaderboard/breakdown · [x] US-6.x match detail

## Security / PBT
- 🔒 SECURITY-04 (security headers are served by CloudFront/infra; SPA sets meta CSP where applicable), SECURITY-13 (SRI for any external scripts — none planned; all bundled). Token kept in localStorage; never logged.
- 🧪 No enforced PBT rules apply to the UI unit (PBT-02/03 are server/shared). Pure format helpers get example tests.

## Verification
`tsc --noEmit` + `vite build` + `vitest` (format helpers).

## Scope
~22 files. No backend changes.
