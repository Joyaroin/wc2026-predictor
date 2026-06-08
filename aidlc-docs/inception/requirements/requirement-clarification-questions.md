# Requirements Clarification Questions

I detected one contradiction and need one detail clarified. Please fill in the `[Answer]:` tags and say "done".

## Contradiction 1: AWS deployment vs. no security rules
You chose **deploy to AWS** (Q7) but also **skip all security rules** (Q8 = B, described as "suitable for PoCs, prototypes, and experimental projects").
Running a publicly reachable app on AWS with **no enforced security baseline** is a risk mismatch (no input validation hardening, no secret-handling rules, no auth on group/admin actions, etc.), especially since there are no user accounts.

### Clarification Question 1
How do you want to resolve the AWS-deploy vs. no-security tension?

A) Enable the **Security Baseline** extension since it will live on AWS (recommended — keeps secrets/API keys, input validation, and basic abuse protection enforced)
B) Keep security rules **OFF** — treat the AWS deployment as a private/personal project and I accept the risk
C) Keep security **OFF for now**, but I'll revisit before making it public
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Clarification 2: AWS deployment style
This informs the later Infrastructure Design stage. Which AWS approach do you prefer?

A) Serverless — Lambda + API Gateway + a managed DB (DynamoDB or RDS), frontend on S3/CloudFront
B) Containers — ECS/Fargate running the Express API + RDS, frontend on S3/CloudFront
C) Simple VM — a single EC2 or Lightsail instance running everything
D) Not sure yet — decide during the Infrastructure Design stage
X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Note on persistence (for your awareness — no answer needed unless you disagree)
Your "require an API key, no offline mode" (Q6 = B) is recorded. Also note: for AWS, a file-based SQLite DB is not durable on serverless/containers, so the database technology will be finalized in the **NFR Requirements** stage (likely RDS/Postgres or DynamoDB). If you have a strong preference, mention it after this line:

[Note]:DynamoDB is the preference
