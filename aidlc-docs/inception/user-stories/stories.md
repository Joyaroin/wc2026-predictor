# User Stories — WC2026 Predictor

Breakdown: **Epic-based**. Format: **Given / When / Then**. Granularity: **small, fine-grained (INVEST)**.
Personas: **Player** (Sam), **Group Organizer** (Priya), **Operator** (Omar).

Traceability: each story references the requirement(s) it satisfies (FR-*/NFR-*/SECURITY-*/PBT-*).

---

## Epic 1 — Identity (no accounts)

### US-1.1 — Create a player by name
**As a** Player, **I want** to start using the app by entering my display name, **so that** I can predict without creating an account.
- Refs: FR-1.1, FR-1.2
- **Given** I am a first-time visitor
  **When** I enter a display name (1–30 chars) and continue
  **Then** a player is created, a stable player ID is issued, and I land on my home screen.
- **Given** I submit an empty or over-length name
  **When** I try to continue
  **Then** I see a validation error and no player is created. *(SECURITY-05)*

### US-1.2 — Be remembered on return
**As a** Player, **I want** the app to remember me, **so that** I don't re-enter my name each visit.
- Refs: FR-1.2
- **Given** I created a player earlier on this device
  **When** I reopen the app
  **Then** I am recognized as the same player (ID restored from local storage) without re-entering my name.

### US-1.3 — Change my display name
**As a** Player, **I want** to edit my display name, **so that** I can fix typos or rebrand.
- Refs: FR-1.3
- **Given** I am an existing player
  **When** I change my name to a valid value
  **Then** my name updates everywhere (groups, leaderboards) while my player ID stays the same.

---

## Epic 2 — Groups (mini-leagues)

### US-2.1 — Create a group
**As a** Group Organizer, **I want** to create a named group, **so that** my friends can compete together.
- Refs: FR-2.1
- **Given** I am a player
  **When** I create a group with a valid name (1–40 chars)
  **Then** the group is created, I am added as a member, and a unique short invite code is generated and shown to me.
- **Given** the invite code is generated
  **Then** it is random/unguessable and unique across groups. *(SECURITY-08, SECURITY-11)*

### US-2.2 — Join a group by invite code
**As a** Player, **I want** to join a group using its code, **so that** I can compete with that friend group.
- Refs: FR-2.2
- **Given** I have a valid invite code
  **When** I submit it
  **Then** I become a member and can see that group's leaderboard and match list.
- **Given** I submit an invalid/unknown code
  **When** I try to join
  **Then** I see a "group not found" error and am not added. *(SECURITY-05, SECURITY-15)*
- **Given** I am already a member
  **When** I submit the same code
  **Then** I am not duplicated and am taken to the group.

### US-2.3 — View my groups
**As a** Player, **I want** to see all groups I belong to, **so that** I can switch between competitions.
- Refs: FR-2.3
- **Given** I belong to one or more groups
  **When** I open my groups list
  **Then** I see each group's name and member count, and can open any of them.

### US-2.4 — View group members
**As a** Group Organizer, **I want** to see who's in my group, **so that** I know who has joined.
- Refs: FR-2.3
- **Given** I am a member of a group
  **When** I open the group
  **Then** I see the list of member display names.

### US-2.5 — Authorization: only members see group data
**As a** Player, **I want** group data restricted to members, **so that** outsiders can't view our league.
- Refs: SECURITY-08
- **Given** I am NOT a member of a group
  **When** I request that group's leaderboard, members, or predictions
  **Then** the request is denied (not found / forbidden). *(object-level access control)*

---

## Epic 3 — Fixtures & Results

### US-3.1 — View the tournament fixtures
**As a** Player, **I want** to see all matches grouped by stage and date, **so that** I know what to predict.
- Refs: FR-3.1, FR-6.3
- **Given** fixtures have been ingested
  **When** I open the fixtures screen
  **Then** I see matches grouped by stage (Groups A–L, R32, R16, QF, SF, 3rd place, Final) and date, each showing both teams, kickoff time in my local timezone, and status.

### US-3.2 — See match status (open / locked / played)
**As a** Player, **I want** each match to clearly show its state, **so that** I know if I can still predict.
- Refs: FR-4.3, FR-4.4, NFR-4.2
- **Given** the current server time
  **When** I view a match before kickoff
  **Then** it shows "Open" and my prediction is editable.
  **When** I view a match at/after kickoff that is not finished
  **Then** it shows "Locked / In play" and my prediction is read-only.
  **When** I view a finished match
  **Then** it shows the final score and my points.

### US-3.3 — Placeholder teams for undetermined knockouts
**As a** Player, **I want** knockout matches with unknown teams shown as placeholders, **so that** the bracket still makes sense early on.
- Refs: FR-3.3
- **Given** a knockout fixture whose participants are not yet decided
  **When** I view it
  **Then** it shows placeholder labels (e.g., "Winner Group A", "Runner-up Group B") and is not predictable until real teams are set.

### US-3.4 — Results & status refresh from the API
**As an** Operator, **I want** the system to periodically pull match status and final scores, **so that** scores update automatically.
- Refs: FR-3.2, NFR-3.2, NFR-5.1
- **Given** the external API is configured and reachable
  **When** the scheduled sync runs
  **Then** match statuses and final scores are updated, and the sync respects the provider's rate limits (interval-based, cached).
- **Given** the external API is unreachable or errors
  **When** a sync runs
  **Then** the last-known data remains intact and the failure is logged (no crash). *(NFR-5.1, SECURITY-15)*

---

## Epic 4 — Predictions

### US-4.1 — Predict a match scoreline
**As a** Player, **I want** to enter a home and away score for a match, **so that** I can compete.
- Refs: FR-4.1, FR-6.3
- **Given** a match is Open
  **When** I enter non-negative integer scores (0–99) for home and away and save
  **Then** my prediction is stored and shown as my pick for that match.
- **Given** I enter invalid values (negative, non-integer, out of range)
  **When** I save
  **Then** I get a validation error and nothing is stored. *(SECURITY-05)*

### US-4.2 — Edit a prediction before kickoff
**As a** Player, **I want** to change my prediction until kickoff, **so that** I can react to news (injuries, lineups).
- Refs: FR-4.3
- **Given** a match is still Open and I have a prediction
  **When** I change and save it
  **Then** the updated prediction replaces the previous one.

### US-4.3 — Predictions lock at kickoff (server-authoritative)
**As a** Group Organizer, **I want** predictions to lock at kickoff, **so that** nobody can predict after a match starts.
- Refs: FR-4.4, NFR-2.2, SECURITY-08, SECURITY-15
- **Given** a match's kickoff time has passed (per the server clock)
  **When** any player tries to create or edit a prediction for it
  **Then** the server rejects the write and the prediction remains as it was at kickoff (fail closed).
- **Given** a client with a wrong local clock
  **When** it attempts a late write
  **Then** the server's clock decides; the client cannot bypass the lock.

### US-4.4 — Knockout predictions are 90-minute scorelines
**As a** Player, **I want** to predict the 90-minute score in knockouts (draws allowed), **so that** rules match the agreed format.
- Refs: FR-4.2
- **Given** a knockout match
  **When** I predict
  **Then** I enter a 90-minute scoreline (draws allowed); I am not asked for extra-time/penalty outcomes.

### US-4.5 — Only I can edit my prediction
**As a** Player, **I want** my predictions to be mine alone, **so that** nobody can tamper with them.
- Refs: SECURITY-08 (IDOR prevention)
- **Given** a prediction belongs to me
  **When** another player attempts to create/edit a prediction under my player ID
  **Then** the server rejects it (ownership verified server-side).

### US-4.6 — Missing prediction scores zero
**As a** Player, **I want** clarity that not predicting scores zero, **so that** I understand the stakes.
- Refs: FR-4.5
- **Given** a match has finished and I never predicted it
  **When** scores are computed
  **Then** I receive 0 points for that match.

---

## Epic 5 — Scoring & Leaderboards

### US-5.1 — Points awarded per match (5/3/2/0)
**As a** Player, **I want** transparent, consistent points, **so that** I trust the competition.
- Refs: FR-5.1, NFR-2.1, PBT-03
- **Given** a finished match with a final score
  **When** my prediction is scored
  **Then**:
  - exact score (home and away both right) ⇒ **5**
  - correct outcome and correct goal difference but not exact ⇒ **3**
  - correct outcome only (W/D/L) ⇒ **2**
  - wrong outcome ⇒ **0**
- **Property (PBT)**: result is always one of {0,2,3,5}; equal prediction and actual always yields 5; a wrong-outcome prediction never scores > 0; a correct-outcome prediction never scores 0.

### US-5.2 — Points recompute on corrected results
**As an** Operator, **I want** points to recompute if a result is corrected, **so that** the table stays accurate.
- Refs: FR-5.2, SECURITY-13
- **Given** a match's final score is later corrected via sync
  **When** the correction is applied
  **Then** affected players' points are recomputed and the change is auditable (who/what/when).

### US-5.3 — View group leaderboard
**As a** Player, **I want** a ranked leaderboard for my group, **so that** I can see who's winning.
- Refs: FR-5.3, NFR-3.1
- **Given** I am a member of a group
  **When** I open its leaderboard
  **Then** members are ranked by total points (highest first), showing each member's name and total.

### US-5.4 — Leaderboard tie-breaker
**As a** Player, **I want** ties broken fairly, **so that** ranks are deterministic.
- Refs: FR-5.4
- **Given** two members have equal total points
  **When** the leaderboard is ordered
  **Then** the member with more exact-score predictions ranks higher; if still tied, the member with more correct results ranks higher.

### US-5.5 — View my points breakdown
**As a** Player, **I want** to see my per-match points and running total, **so that** I understand my score.
- Refs: FR-5.5
- **Given** matches I predicted have finished
  **When** I view my breakdown
  **Then** I see each match's prediction, actual score, and points earned, plus my cumulative total.

---

## Epic 6 — Match Detail & Fair Play

### US-6.1 — Rivals' predictions hidden until lock
**As a** Group Organizer, **I want** members' predictions hidden until a match locks, **so that** nobody copies.
- Refs: FR-2.5, SECURITY-08
- **Given** a match is still Open
  **When** I open its detail in a group
  **Then** I can see only my own prediction; other members' predictions are hidden.
- **Given** a match has locked (kickoff passed)
  **When** I open its detail
  **Then** I can see all group members' predictions.

### US-6.2 — Match detail shows everyone vs the result
**As a** Player, **I want** to compare all members' picks against the actual result, **so that** I can enjoy the outcome.
- Refs: FR-6.5
- **Given** a locked or finished match
  **When** I open its detail in a group
  **Then** I see each member's prediction, the actual score (if finished), and the points each member earned.

---

## Epic 7 — Operations, Config & Security

### US-7.1 — Configure the API key securely
**As an** Operator, **I want** to set the football API key as a managed secret, **so that** it is never exposed.
- Refs: FR-3.4, SECURITY-12 (credential handling), SECURITY-09
- **Given** I deploy the app
  **When** I provide the API key via a secrets manager / encrypted env (not source code)
  **Then** the app reads it securely and never logs or returns it.

### US-7.2 — Clear error when API key is missing
**As an** Operator, **I want** an explicit error when no key is configured, **so that** I can fix it fast.
- Refs: FR-3.4, SECURITY-15
- **Given** no valid API key is configured
  **When** the app starts or a sync runs
  **Then** it surfaces a clear configuration error and does not silently serve empty/garbage data.

### US-7.3 — Secure responses & headers
**As an** Operator, **I want** security headers and locked-down CORS, **so that** the app resists common web attacks.
- Refs: SECURITY-04, SECURITY-08 (CORS)
- **Given** the frontend is served
  **When** a response is returned
  **Then** it includes CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy; and the API's CORS allows only the known frontend origin (no wildcard).

### US-7.4 — Safe errors & logging
**As an** Operator, **I want** generic error messages and structured logs, **so that** I can debug without leaking internals.
- Refs: SECURITY-03, SECURITY-09, SECURITY-14, SECURITY-15
- **Given** an unexpected error occurs
  **When** it is returned to a user
  **Then** the response is generic (no stack trace/internal details), while a structured log entry (timestamp, request ID, level, message — no secrets/PII) is recorded centrally with >= 90-day retention.

### US-7.5 — Rate limiting / abuse protection
**As an** Operator, **I want** public endpoints throttled, **so that** invite-code guessing and spam are mitigated.
- Refs: SECURITY-11
- **Given** a client makes excessive requests (e.g., brute-forcing invite codes)
  **When** the rate threshold is exceeded
  **Then** further requests are throttled/blocked.

---

## Story-to-Persona Map

| Story | Player (Sam) | Organizer (Priya) | Operator (Omar) |
|---|:---:|:---:|:---:|
| US-1.1, US-1.2, US-1.3 | ✓ | ✓ | |
| US-2.1, US-2.4 | | ✓ | |
| US-2.2, US-2.3, US-2.5 | ✓ | ✓ | |
| US-3.1, US-3.2, US-3.3 | ✓ | ✓ | |
| US-3.4 | | | ✓ |
| US-4.1–US-4.6 | ✓ | ✓ | |
| US-5.1 | ✓ | ✓ | ✓ |
| US-5.2 | | | ✓ |
| US-5.3, US-5.4, US-5.5 | ✓ | ✓ | |
| US-6.1 | ✓ | ✓ | |
| US-6.2 | ✓ | ✓ | |
| US-7.1–US-7.5 | | | ✓ |

## INVEST & Coverage Notes
- Stories are independent, small, and testable; each carries explicit acceptance criteria.
- FR coverage: FR-1 (Epic 1), FR-2 (Epic 2), FR-3 (Epic 3), FR-4 (Epic 4), FR-5 (Epic 5), FR-6 (Epics 3/5/6).
- Security coverage embedded as acceptance criteria (SECURITY-03/04/05/08/09/11/12/13/14/15).
- US-5.1 is the anchor for Partial PBT (PBT-03 invariants on scoring; PBT-07 generators; PBT-08 shrinking/seed; PBT-09 fast-check).
