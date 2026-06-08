# End-to-End Test Instructions

## Purpose
Validate complete user workflows in a running environment.

## Current Status
No browser E2E suite is committed yet. The backend integration tests cover the main workflow behaviors at the HTTP layer, and the web build verifies the SPA compiles and bundles.

## Recommended Manual E2E Smoke Test
Run against local memory mode or deployed dev:

1. Open the web app.
2. Sign up with a unique display name and 4-digit PIN.
3. Create a friend group.
4. Copy the invite code.
5. In a second browser/session, sign up as another player and join the group.
6. Submit predictions for an unlocked match.
7. Verify the prediction appears under "My Breakdown".
8. Verify the group leaderboard is visible to members.
9. Change the first player's PIN in settings.
10. Confirm the old PIN no longer works and the new PIN works.
11. Delete the group as the creator, or leave it as a non-creator.

## Recommended Automation
Add Playwright after the first deployed dev environment is reachable:

```bash
npm install -D @playwright/test --workspace @wc2026/web
npx playwright install
npm run test:e2e --workspace @wc2026/web
```

Initial E2E scenarios should mirror the smoke test above and use stable `data-testid` attributes already present in the UI.
