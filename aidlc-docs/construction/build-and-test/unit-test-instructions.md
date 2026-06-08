# Unit Test Execution

## Run All Tests
```bash
npm test
```

The root script runs `vitest run` across workspaces:
- `packages/shared`
- `api`
- `web`

## Expected Results
- Shared package: 22 tests pass.
- API package: 30 tests pass.
- Web package: 5 tests pass.
- Total: 57 tests pass, 0 failures.

## Coverage Notes
The project does not currently generate a coverage report. Test coverage is concentrated on:
- Pure scoring and leaderboard ordering logic.
- Zod schema validation and property-based scoring invariants.
- PIN hashing and signed session tokens.
- DynamoDB mapper round-trips.
- API auth, prediction, leaderboard, group delete/leave, and PIN-change flows.
- Web formatting helpers.

## Fixing Failures
1. Reproduce with the narrowest workspace command, for example:
   ```bash
   npm run test --workspace @wc2026/api
   ```
2. Fix the failing implementation or incorrect test expectation.
3. Rerun `npm test`.
4. Rerun `npm run build` if TypeScript-facing code changed.
