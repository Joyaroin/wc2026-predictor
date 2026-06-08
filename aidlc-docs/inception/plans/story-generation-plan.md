# Story Generation Plan

**Role**: Product Owner
**Purpose**: Convert the approved requirements into INVEST user stories with acceptance criteria, plus personas.

---

## Part A: Planning Questions (please answer)

Fill in each `[Answer]:` tag with a letter (or X + description). Say "done" when finished.

### Question 1 — Story breakdown approach
How should I organize the user stories?

A) **Epic-based** — group stories under epics (Identity, Groups, Predictions, Scoring & Leaderboards, Fixtures/Results, Ops), each with child stories (recommended — maps cleanly to units of work later)
B) **User journey-based** — stories follow end-to-end flows (onboard → join group → predict → see results)
C) **Feature-based** — one group of stories per feature, flat
D) **Persona-based** — stories grouped by who performs them
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 2 — Persona set
Which personas should I document?

A) **Player** (casual predictor) + **Group Organizer** (creates/runs a group) + **Operator** (deploys app, sets the API key) (recommended)
B) Just **Player** + **Group Organizer** (skip the Operator/admin persona)
C) Single generic **Player** persona only
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 3 — Acceptance-criteria format
What format do you want for acceptance criteria?

A) **Given / When / Then** (Gherkin-style) — precise and testable, good for driving the scoring/lock tests (recommended)
B) Plain bullet checklist of conditions
C) Both: Given/When/Then for complex stories, bullets for simple ones
X) Other (please describe after [Answer]: tag below)

[Answer]:A

### Question 4 — Story granularity
How granular should stories be?

A) **Small, fine-grained** stories (one capability each) — best for INVEST and incremental build (recommended)
B) Medium — a few related capabilities per story
C) Larger, epic-sized stories with detailed criteria
X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## Part B: Generation Steps (executed after Part A is approved)

- [x] Generate `aidlc-docs/inception/user-stories/personas.md` with the chosen persona set (archetypes, goals, characteristics, pain points)
- [x] Generate `aidlc-docs/inception/user-stories/stories.md` with INVEST stories grouped per the chosen breakdown approach
- [x] Write acceptance criteria for each story in the chosen format
- [x] Cover all functional requirements: FR-1 Identity, FR-2 Groups, FR-3 Fixtures/Results, FR-4 Predictions, FR-5 Scoring/Leaderboards, FR-6 Views
- [x] Include security-relevant stories/criteria (object-level access: can't edit others' predictions; rivals hidden until lock; unguessable invite codes; API-key-missing handling) per Security Baseline
- [x] Include explicit acceptance criteria for the four scoring tiers (5/3/2/0) and kickoff-lock behavior (feeds Partial PBT on scoring)
- [x] Ensure every story is Independent, Negotiable, Valuable, Estimable, Small, Testable
- [x] Map each persona to its relevant stories (story-to-persona map)
- [x] Update `aidlc-state.md` progress

## Planning Answers (recorded)
- Q1 Breakdown = A (Epic-based)
- Q2 Personas = A (Player + Group Organizer + Operator)
- Q3 Acceptance criteria = A (Given/When/Then)
- Q4 Granularity = A (Small, fine-grained)
- Analysis: all answers unambiguous (all recommended defaults); no follow-up clarifications required.
