# Requirements Clarification Questions

Please answer each question by filling in the letter choice after the `[Answer]:` tag.
If none of the options match, choose the **Other** option and describe your preference after the tag.
Let me know when you're done (say "done").

> **Already captured** (no need to re-answer — listed here for confirmation):
> - **Stack**: React frontend + Node/Express backend
> - **Identity**: No authentication — users just enter a name
> - **Groups**: Users can create a group of friends and compete with each other
> - **Fixtures**: A free or low-cost live football API

---

## Question 1
How should the **scoring system** work (FIFA-style points per match)?

A) Exact score = 5, correct goal difference = 3, correct result (W/D/L) = 2, wrong = 0 (recommended default)
B) Exact score = 3, correct result = 1, wrong = 0 (simple)
C) Only correct result matters: correct = 1, wrong = 0
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question 2
For **knockout matches** (Round of 32 onward), what do players predict?

A) Predict the 90-minute scoreline only (draws allowed), scored like group games (recommended, simplest)
B) Predict the scoreline AND who advances (extra points for picking the team that goes through, including via penalties)
C) Predict only who advances (winner of each tie), no scoreline
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question 3
When should a prediction **lock** (no longer editable)?

A) At the match kickoff time (recommended)
B) A fixed buffer before kickoff (e.g. 5 minutes before)
C) When the whole matchday/round starts (all matches lock together)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question 4
How should players **join a friend group**?

A) A short shareable invite code they type in (recommended, no accounts needed)
B) A shareable invite link/URL
C) Both a code and a link
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question 5
**Leaderboard tie-breaker** when two players have equal total points — rank them by:

A) Most exact-score predictions, then most correct results (recommended)
B) Alphabetical / join order only (keep it simple)
C) Head-to-head on matches both predicted
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question 6
The free football API may not always have a valid key configured. What should the app do **without an API key**?

A) Ship with bundled seed fixtures (the 48-team, 12-group 2026 structure) so the app fully works offline, and switch to live data when a key is added (recommended)
B) Require an API key to run at all (no offline mode)
C) Allow manual entry of fixtures/results via a simple admin screen instead
X) Other (please describe after [Answer]: tag below)

[Answer]:B

## Question 7
Where do you plan to **run / deploy** this?

A) Local development only for now (run on my machine) (recommended to start)
B) Free-tier cloud hosting (e.g. Render/Railway/Fly/Vercel) later
C) Self-hosted on my own server/VPS
X) Other (please describe after [Answer]: tag below)

[Answer]:X AWS

## Question 8: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]:B

## Question 9: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)
C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)
X) Other (please describe after [Answer]: tag below)

[Answer]:B
