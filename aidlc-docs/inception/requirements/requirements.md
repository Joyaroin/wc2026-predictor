# Requirements — WC2026 Predictor

## 1. Intent Analysis

| Attribute | Value |
|---|---|
| **User Request** | "Exactly mimic the FIFA official predictor, but for the 2026 World Cup." |
| **Request Type** | New Project (greenfield) |
| **Clarity** | Clear (refined via clarifying + clarification questions) |
| **Scope** | Multiple Components (React client, Express API, DynamoDB, external football API integration) |
| **Complexity** | Moderate |
| **Requirements Depth** | Standard |

**Product summary**: A web app where friends predict the exact scoreline of every 2026 FIFA World Cup match. Predictions lock at kickoff, are scored against real results pulled from a live football API, and players compete on per-group leaderboards. Players identify with a **unique name + 4-digit PIN** (no email/social accounts) which lets them resume on any device, and join friend groups via a short invite code.

**2026 tournament context (drives the data model)**: First 48-team World Cup, hosted in USA/Canada/Mexico. **12 groups (A–L) of 4 teams**, **104 matches** total. Group stage → Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Third-place play-off → Final.

---

## 2. Functional Requirements

### FR-1 — Player identity (name + PIN, no email/accounts)
- FR-1.1: A player is identified by a **unique display name + a 4-digit PIN**. No email, no social accounts. (Updated during backend Functional Design — decision CQ1=A.)
- FR-1.2: **Login/resume**: entering the same name + PIN on any device resumes that same player (cross-device) and authorizes their writes. First use of a free name creates the player with that PIN.
- FR-1.3: **Display names are unique** (first-come). If a name is taken, the user either picks another or logs in with the matching PIN. (decision CQ2=A.)
- FR-1.4: On successful login the server issues a **signed session token** (with expiry) that the client sends on subsequent requests; the player ID is internal and not exposed to other players.
- FR-1.5: The PIN is a **credential** (see SECURITY-12): stored only as a salted hash, never logged; the login endpoint is rate-limited. Per decision CQ3=B (minimal hardening) the 4-digit length is accepted for this casual game; no hard account-lockout is required beyond rate limiting.
- FR-1.6: **Change PIN** (added 2026-06-08). From an account-settings screen, a logged-in player can change their PIN by entering their **current PIN** + a new PIN. The server verifies the current PIN before updating (rate-limited; SECURITY-12). Wrong current PIN → 401.

### FR-2 — Friend groups (mini-leagues)
- FR-2.1: A player can create a group by naming it; the system generates a unique **short invite code**.
- FR-2.2: A player can join an existing group by entering its invite code.
- FR-2.3: A player can belong to multiple groups; a group has many players.
- FR-2.4: A group exposes a leaderboard ranking its members (see FR-5).
- FR-2.5: Members can view each other's predictions for a match **only after that match has locked** (kickoff passed), to prevent copying.
- FR-2.6: **Delete group** (added 2026-06-08). Only the group's **creator** can delete it, which removes the group and all memberships for everyone (predictions are per-player and are not affected). Non-creators attempting deletion get 403.
- FR-2.7: **Leave group** (added 2026-06-08). A non-creator member can leave a group (removing only their own membership). The creator cannot "leave" — they must delete the group instead.

### FR-3 — Fixtures & results
- FR-3.1: The system ingests the full 2026 World Cup fixture list (104 matches) from a live football API: teams, kickoff time (UTC), stage, group label, and status.
- FR-3.2: The system periodically refreshes match status and final scores from the API.
- FR-3.3: Knockout fixtures whose participants are not yet determined are shown as placeholders (e.g., "Winner Group A") until the API resolves the teams.
- FR-3.4: A valid API key is **required**; with no key configured the system surfaces a clear configuration error (no offline/seed fallback — per decision Q6).

### FR-4 — Predictions
- FR-4.1: A player predicts an exact scoreline (home goals, away goals) for each match.
- FR-4.2: For knockout matches, players predict the **90-minute scoreline only** (draws allowed); extra time / penalties are not predicted.
- FR-4.3: A prediction can be created or edited any time **before kickoff**.
- FR-4.4: At kickoff the prediction **locks** and becomes read-only. Edits to a locked match are rejected server-side (authoritative server clock).
- FR-4.5: Missing prediction for a played match scores 0.

### FR-5 — Scoring & leaderboards
- FR-5.1: Per-match points: **exact score = 5**, **correct goal difference (right outcome, right margin, not exact) = 3**, **correct result (right outcome only) = 2**, **wrong = 0**.
- FR-5.2: Points are computed when a match's final score is recorded, and recomputed if a result is corrected.
- FR-5.3: A group leaderboard ranks members by total points (sum across all matches).
- FR-5.4: **Tie-breaker**: most exact-score predictions, then most correct results.
- FR-5.5: A player can see their own per-match points breakdown and running total.

### FR-6 — Views (UI)
- FR-6.1: Name-entry / landing screen.
- FR-6.2: Group list, create-group, join-group screens.
- FR-6.3: Fixtures screen grouped by stage and date, showing each match's status, the player's prediction (editable if open, locked otherwise), and points once played.
- FR-6.4: Leaderboard screen per group.
- FR-6.5: Match-detail screen showing all group members' predictions for that match (after lock) plus the actual result.

---

## 3. Non-Functional Requirements

### NFR-1 — Architecture & deployment
- NFR-1.1: AWS **serverless** — API on Lambda behind API Gateway; React frontend hosted on S3 + CloudFront.
- NFR-1.2: Persistence in **DynamoDB**.
- NFR-1.3: Backend implemented in Node/Express, adapted to run on Lambda (e.g., via a Lambda HTTP adapter) so the same app can run locally and on AWS.

### NFR-2 — Correctness of scoring (testability)
- NFR-2.1: The scoring function is pure and deterministic, with property-based + example-based tests (see §5).
- NFR-2.2: Server time is authoritative for lock enforcement; clients never decide lock state.

### NFR-3 — Performance & cost
- NFR-3.1: Leaderboard and fixtures reads target sub-second response for typical group sizes (tens of members).
- NFR-3.2: API polling of the external provider must respect free-tier rate limits (cache/refresh on an interval, not per-request).

### NFR-4 — Usability
- NFR-4.1: Mobile-first responsive layout (most users predict on phones).
- NFR-4.2: Clear visual states: open / locked / played, and points earned.

### NFR-5 — Reliability
- NFR-5.1: External API failures must not break the app; last-known fixtures/results remain readable and the failure is logged.
- NFR-5.2: All external calls have explicit error handling and fail closed for write operations (per SECURITY-15).

---

## 4. Security Requirements (Security Baseline extension — ENABLED)

The Security Baseline extension is enabled. Applicability of each rule to this no-login, serverless app:

| Rule | Applies? | Requirement in this project |
|---|---|---|
| SECURITY-01 Encryption at rest/in transit | Yes | DynamoDB encryption at rest; HTTPS/TLS everywhere (CloudFront, API Gateway). |
| SECURITY-02 Access logging on intermediaries | Yes | API Gateway access logging; CloudFront logging. |
| SECURITY-03 Application logging | Yes | Structured logging with request/correlation ID; no secrets/PII in logs. |
| SECURITY-04 HTTP security headers | Yes | CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy on served HTML. |
| SECURITY-05 Input validation | Yes | Validate/normalize all API inputs (names, codes, scores, IDs); bounded lengths; DynamoDB parameterized SDK calls (no injection). |
| SECURITY-06 Least-privilege IAM | Yes | Lambda role scoped to specific DynamoDB tables/actions; no wildcards. |
| SECURITY-07 Restrictive network config | Partial/N-A | Serverless managed networking; document any VPC use. |
| SECURITY-08 App-level access control | Yes (adapted) | No accounts, so deny-by-default is relaxed, BUT: object-level checks (only group members read a group's data; only the owning player edits their own prediction); CORS restricted to the known frontend origin (no wildcard); no admin/privileged routes exposed publicly. |
| SECURITY-09 Hardening / misconfiguration | Yes | No default creds; generic production error messages (no stack traces); S3 public access blocked except static site path; supported runtimes. |
| SECURITY-10 Supply chain | Yes | Lock file committed; dependency vulnerability scan in CI; pinned versions; no `latest` image tags. |
| SECURITY-11 Secure design | Yes | Rate limiting/throttling on public API (API Gateway); abuse case considered (invite-code guessing, prediction tampering); scoring/lock logic isolated. |
| SECURITY-12 Authentication & credentials | **Yes** (updated) | PIN is a credential: stored as a **salted hash** (Node scrypt — adaptive), never logged; login **rate-limited** (brute-force control per CQ3=B; full lockout not mandated for this casual 4-digit game); **signed session token** with server-side expiry issued on login and validated per request; secrets (token-signing key, external API key) from a secrets manager, never in source. |
| SECURITY-13 Software/data integrity | Yes | SRI for any external CDN scripts; result changes auditable (who/what/when); safe JSON handling. |
| SECURITY-14 Alerting & monitoring | Yes (scaled) | Log retention >= 90 days; alarms on elevated error rates / authorization failures; app cannot delete its own logs. |
| SECURITY-15 Exception handling / fail-safe | Yes | Global error handler; all external/DB calls wrapped; fail closed on writes. |

**Key security notes for this app**:
- **No accounts** changes the *authentication* posture (SECURITY-12 mostly N/A) but **not** the *authorization* posture — SECURITY-08 still requires object-level checks so players cannot edit others' predictions or read locked-out data, and invite codes must be unguessable.
- The **external football API key** is the primary secret to protect (SECURITY-12 credential-management clause).

---

## 5. Testing Requirements (Property-Based Testing extension — PARTIAL)

Enforced (blocking) PBT rules: **PBT-02, PBT-03, PBT-07, PBT-08, PBT-09**. Others advisory.

- **PBT-09 (framework)**: Use **fast-check** with the JS test runner (Vitest or Jest).
- **PBT-03 (invariants)** for the scoring function, e.g.:
  - Points are always one of {0, 2, 3, 5}.
  - Identical prediction and actual ⇒ always 5 (exact).
  - Scoring is symmetric under swapping home/away in both prediction and actual.
  - A correct-outcome prediction never scores 0; a wrong-outcome prediction never scores >0.
- **PBT-02 (round-trip)** for any serialization between API/DynamoDB item shapes and domain objects (encode → decode = identity).
- **PBT-07 (generators)**: domain generators for scorelines, matches, predictions (bounded, realistic goal counts).
- **PBT-08 (shrinking/repro)**: shrinking enabled; seed logged on failure; PBT runs in CI.
- Complementary example-based tests pin the four scoring tiers explicitly.

---

## 6. Out of Scope (v1)
- Email-based or social-login accounts, password reset flows, email verification. (A lightweight name + 4-digit PIN is the only credential.)
- Predicting extra-time/penalty outcomes in knockouts.
- Predicting full bracket progression as a separate game (only per-match scorelines).
- Real-money or betting features.
- Push notifications / email.

---

## 7. Key Requirements Summary
- Name + 4-digit PIN players (cross-device, no email/accounts); friend groups via invite code; per-group leaderboards.
- Predict exact scorelines for all 104 matches; lock at kickoff; score 5/3/2/0.
- Live fixtures/results from a free football API (key required).
- AWS serverless (Lambda + API Gateway + DynamoDB; React on S3/CloudFront).
- Security Baseline enforced (with auth rules adapted for the no-account model); Partial property-based testing centered on the scoring logic.
