# Personas — WC2026 Predictor

## Persona 1: Sam — The Player (Casual Predictor)
- **Archetype**: Football fan who wants bragging rights among friends during the World Cup.
- **Tech comfort**: Medium. Predicts on a phone, on the go, often minutes before kickoff.
- **Goals**:
  - Quickly enter scoreline predictions for upcoming matches.
  - See how many points they earned and where they rank against friends.
- **Motivations**: Fun, competition, social banter.
- **Pain points**:
  - Forgetting to predict before a match starts.
  - Confusing UIs that bury today's matches.
  - Not trusting the scoring (wants it transparent).
- **Key needs**: Fast prediction entry, clear open/locked/played states, visible points breakdown.

## Persona 2: Priya — The Group Organizer
- **Archetype**: The friend who sets up the office/family mini-league and recruits everyone.
- **Tech comfort**: Medium-high.
- **Goals**:
  - Create a group and share an invite code with friends.
  - Track the group's leaderboard and keep people engaged.
- **Motivations**: Bringing the group together; running a fair competition.
- **Pain points**:
  - Complicated sign-up flows scare off casual friends (wants no-account joining).
  - Worrying that people can copy each other's predictions.
- **Key needs**: One-tap group creation, easy-to-share code, fair play (predictions hidden until kickoff), reliable leaderboard.

## Persona 3: Omar — The Operator
- **Archetype**: The person (could be the developer/owner) who deploys and maintains the app on AWS.
- **Tech comfort**: High.
- **Goals**:
  - Configure the external football API key securely.
  - Keep fixtures/results syncing and the app healthy.
- **Motivations**: A reliable, low-cost, secure deployment.
- **Pain points**:
  - Leaking the API key.
  - Silent sync failures making scores stale.
- **Key needs**: Secure secret handling, clear config errors, logging/alerting on sync and errors.
