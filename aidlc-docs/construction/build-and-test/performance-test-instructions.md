# Performance Test Instructions

## Purpose
Validate that the app remains responsive at the intended casual-game scale: up to a few thousand players and dozens of groups.

## Performance Requirements
- API read p95 latency target: less than 500 ms for fixtures and leaderboards at target scale.
- Sync cadence: every 10 minutes, never per user request.
- Leaderboard reads use precomputed prediction points.
- DynamoDB uses on-demand capacity.

## Current Status
No automated load test is committed yet. The Build and Test stage verified functional correctness, static builds, dependency security, Helm rendering, and Terraform validation.

## Recommended Load Test
Use k6 or a similar tool after the k3s environment is deployed.

Example scenarios:
- 50 concurrent users logging in and reading fixtures.
- 50 concurrent users submitting predictions for unlocked matches.
- 20 groups with 100 members each reading leaderboards.
- One sync job execution against football-data.org using a real token.

Suggested command shape:
```bash
k6 run performance/wc2026-api.k6.js
```

## Pass Criteria
- p95 API read latency below 500 ms.
- Error rate below 1 percent for authenticated app requests.
- No sustained DynamoDB throttling.
- Sync failures are logged and do not break read endpoints.

## Follow-up Work
Add a small k6 suite once the first public dev environment exists, because meaningful performance results need the real ingress, EC2 instance size, and DynamoDB path.
