# Unit of Work — Story Map

Every user story (from stories.md) is assigned to a unit. Most user-facing stories span `web` (UI) + `backend` (logic); the table lists the **primary owning unit(s)**.

| Story | Title | shared | backend | web | infra |
|---|---|:--:|:--:|:--:|:--:|
| US-1.1 | Create player by name | | ✓ | ✓ | |
| US-1.2 | Remembered on return | | | ✓ | |
| US-1.3 | Change display name | | ✓ | ✓ | |
| US-2.1 | Create a group (+ invite code) | | ✓ | ✓ | |
| US-2.2 | Join group by code | | ✓ | ✓ | |
| US-2.3 | View my groups | | ✓ | ✓ | |
| US-2.4 | View group members | | ✓ | ✓ | |
| US-2.5 | Members-only group data | | ✓ | | |
| US-3.1 | View fixtures by stage/date | | ✓ | ✓ | |
| US-3.2 | Match status open/locked/played | ✓ | ✓ | ✓ | |
| US-3.3 | Knockout placeholders | | ✓ | ✓ | |
| US-3.4 | Results/status sync | | ✓ | | ✓ (schedule) |
| US-4.1 | Predict a scoreline | ✓ (validate) | ✓ | ✓ | |
| US-4.2 | Edit before kickoff | | ✓ | ✓ | |
| US-4.3 | Lock at kickoff (server) | | ✓ | | |
| US-4.4 | Knockout 90-min score | | ✓ | ✓ | |
| US-4.5 | Only I edit my prediction | | ✓ | | |
| US-4.6 | Missing prediction = 0 | ✓ | ✓ | ✓ | |
| US-5.1 | Points 5/3/2/0 | ✓ (engine) | ✓ (persist) | ✓ (preview) | |
| US-5.2 | Recompute on correction | ✓ | ✓ | | |
| US-5.3 | Group leaderboard | | ✓ | ✓ | |
| US-5.4 | Tie-breaker | ✓ (comparator) | ✓ | ✓ | |
| US-5.5 | My points breakdown | | ✓ | ✓ | |
| US-6.1 | Rivals hidden until lock | | ✓ | ✓ | |
| US-6.2 | Match detail vs result | | ✓ | ✓ | |
| US-7.1 | Secure API key config | | ✓ | | ✓ (Secrets Manager) |
| US-7.2 | Clear error if key missing | | ✓ | | |
| US-7.3 | Security headers + CORS | | ✓ | ✓ (SRI) | ✓ (CloudFront) |
| US-7.4 | Safe errors + logging | | ✓ | | ✓ (CloudWatch) |
| US-7.5 | Rate limiting | | ✓ | | ✓ (gateway/WAF) |

## Coverage check
- **All 30 stories assigned.** No orphans.
- `shared` owns scoring/validation primitives (US-3.2, US-4.1, US-4.6, US-5.1, US-5.2, US-5.4).
- `backend` owns all business rules, authorization, and integration.
- `web` owns presentation for every user-facing story.
- `infra` owns deployment-side security/ops (US-3.4 schedule, US-7.1/7.3/7.4/7.5).

## Extension placement
- 🔒 **Security Baseline**: app rules → `backend` (+ `web` for headers/SRI); infra rules → `infra`.
- 🧪 **PBT (Partial)**: PBT-02/03/07/08 → `shared` (scoring) + `backend` (DTO round-trips); PBT-09 framework (fast-check) configured in `shared` and `backend`.
