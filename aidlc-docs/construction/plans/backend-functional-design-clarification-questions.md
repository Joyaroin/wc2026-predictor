# Backend Functional Design — Clarification Questions

Your Q2 answer ("make the player id depend on a 4-digit PIN") needs clarification. A PIN introduces authentication, which (a) activates Security Baseline **SECURITY-12** and (b) likely requires **unique display names**. Please answer.

## Clarification 1 — What is the PIN for?
A) **Cross-device resume + write protection** — a player is identified by **name + 4-digit PIN**. Entering the same name+PIN on any device resumes that same player and authorizes their writes. (most useful — lets friends log in from any device without accounts) (recommended)
B) **Local lock only** — keep the generated UUID identity (as in option 2A originally), and the PIN just protects the existing player on this device
C) **Group PIN** — the PIN is per-group (to join a group), not per-player
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Clarification 2 — Display name uniqueness (only relevant if CQ1 = A)
If name + PIN identifies a player, names must be unique so login is deterministic. OK to make display names **unique**?
A) **Yes — names are unique** (first-come; if taken, the user must pick another or enter the matching PIN to log in) (recommended)
B) No — keep names non-unique (then login must use something else; please describe)
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Clarification 3 — PIN security hardening (SECURITY-12, since PIN = credential)
A) **Standard hardening** — store only a salted hash of the PIN (bcrypt/argon2), rate-limit + temporary lockout after repeated wrong PINs, never log the PIN (recommended)
B) Minimal — hash the PIN + basic rate limit; accept the 4-digit weakness for a casual game
C) Strengthen — require a **6-digit** PIN to reduce brute-force risk, plus the hardening in A
X) Other (please describe after [Answer]: tag below)

[Answer]:B

> Note: whichever you choose, I'll update `requirements.md` (FR-1 identity) and the Security mapping (SECURITY-12 changes from N/A to in-scope) to keep the audit trail consistent.
