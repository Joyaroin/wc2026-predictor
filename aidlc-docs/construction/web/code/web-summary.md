# Code Summary — Unit `web`

## Verification (executed)
- `tsc --noEmit`: clean
- `vitest`: **5/5 pass** (format helpers)
- `vite build`: success (≈88 KB gzipped)
- `npm audit`: 0 vulnerabilities

## Files (web/)
- Scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `src/vite-env.d.ts`.
- `src/api/client.ts` — typed REST client (Bearer token, shared DTOs, `ApiError`).
- `src/context/PlayerContext.tsx` — token+player in localStorage; `usePlayer`.
- `src/lib/format.ts` — pure helpers (matchState, pointsLabel, formatKickoff, stageLabel).
- Components: `Nav`, `StatusBadge`, `MatchCard`, `LeaderboardTable` (stable `data-testid`s).
- Pages: `LandingPage`, `GroupsPage`, `GroupDetailPage`, `FixturesPage`, `MatchDetailPage`, `MyBreakdownPage`.
- `App.tsx` (routes + auth guard), `main.tsx` (providers), `styles.css` (mobile-first).
- `test/format.test.ts`, `README.md`.

## Story coverage
US-1.1/1.2 (Landing login/resume) · US-2.1/2.2/2.3/2.4 (Groups) · US-3.1/3.2/3.3 (Fixtures + status + placeholders) · US-4.1/4.2/4.4 (predict, locked view) · US-5.3/5.4/5.5 (leaderboard + breakdown) · US-6.1/6.2 (match detail visibility).

## Security / PBT
- 🔒 Token stored client-side, never logged; security response headers are served by CloudFront/API Gateway (`infra`). No external CDN scripts (everything bundled) → SECURITY-13 SRI N/A.
- 🧪 No enforced PBT rules apply to the UI; pure format helpers covered by example tests.
