# Security Review Findings

Date: 2026-06-14

Scope reviewed:

- API: Express routes, auth/session handling, middleware, DynamoDB repositories, provider integrations.
- Frontend: Vite/React app, API client, session storage, HTML rendering, nginx static hosting.
- Infrastructure: Terraform AWS/k3s, Helm chart, GitOps manifests, Dockerfiles, GitHub Actions.
- Tooling: `gitleaks`, `detect-secrets`, and `npm audit`.

This report does not include secret values. Any local secret-like findings are described by file and variable type only.

## Executive Summary

The codebase already has several good controls: Helmet on the API, strict CORS config, zod request validation, small request body limits, global/login/join rate limits, scrypt PIN hashing, timing-safe session signature comparison, non-root API containers, DynamoDB encryption/PITR, and CI production dependency auditing.

The main risks are concentrated in identity/admin design and infrastructure credential boundaries:

- Account security depends on a public display name plus a 4-digit PIN.
- Some admin permissions are granted by matching a configured display name, which defaults to `adham`.
- API/sync pods rely on the EC2 node role via IMDS, so a pod compromise can become an AWS credential compromise.
- Local ignored files contain real secrets and Terraform state.
- Browser sessions are stored in `localStorage` without a CSP or static-site security headers.

## Findings

### High: Admin Privileges Are Bound to a Display Name

Evidence:

- `api/src/lib/config.ts:42-43` defaults `ADMIN_PLAYER` to `adham`.
- `api/src/services/feedback.ts:27-31` treats a user as admin when their stored player name lowercases to the configured admin player.
- `api/src/routes/index.ts:110-124` uses that admin check for feedback inbox, rescore, and feature flag admin paths.

Impact:

- If the configured admin player account does not already exist, an attacker can sign up with that name and receive admin privileges.
- If the account does exist, it is still protected only by the same 4-digit PIN model as normal users.
- Rename behavior also makes admin identity depend on mutable display-name state.

Recommendation:

- Replace display-name admin checks with a stable admin allowlist using immutable `playerId` values or a dedicated role field.
- Require `ADMIN_PLAYER_ID` or an explicit admin role assignment; do not default to a real-looking name.
- Consider disabling all player-name-based admin paths unless explicitly configured.

### High: 4-Digit PIN Login Is Brute-Forceable

Evidence:

- `api/src/routes/index.ts:28-31` accepts only a 4-digit PIN.
- `api/src/services/auth.ts:28-33` logs in by public player name plus PIN.
- `api/src/middleware/index.ts:58-60` rate-limits login by request source, but there is no per-account lockout, backoff, or failed-attempt counter.
- `api/src/lib/config.ts:40` defaults session TTL to 30 days.

Impact:

- A known player name has only 10,000 possible PINs.
- The current IP-based limiter slows casual guessing, but distributed attempts or shared proxy behavior can bypass the intent.
- A guessed PIN yields a long-lived bearer token.

Recommendation:

- Move to longer passcodes or passwordless magic links if this app is public.
- Add per-player failed-attempt tracking with temporary lockouts/backoff.
- Add alerting/logging for repeated failed login attempts by player name.
- Shorten token TTL or add refresh/revocation if account takeover risk matters.

### High: Pod Compromise Can Expose Node IAM Credentials

Evidence:

- `infra/terraform/modules/k3s/main.tf:77-94` grants the EC2 node role DynamoDB access and SSM parameter reads.
- `infra/terraform/modules/k3s/main.tf:122-126` enables IMDSv2 with hop limit `2`.
- `infra/helm/wc2026/templates/networkpolicy.yaml:32-55` explicitly allows API and sync pods to reach `169.254.169.254`.
- `infra/helm/wc2026/values-dev.yaml:13-16` and `values-prod.yaml:15-19` leave `serviceAccount.roleArn` empty, relying on the node role.

Impact:

- A remote code execution bug in the API or sync job can retrieve AWS credentials from IMDS.
- Those credentials can read/write both app DynamoDB tables and read the configured SSM secret parameter.
- NetworkPolicy limits IMDS to API/sync pods, which helps, but those are exactly the pods handling external input and provider data.

Recommendation:

- Prefer per-workload IAM. On EKS, use IRSA. On k3s, consider kiam/kube2iam alternatives, explicit credential injection from a secrets operator, or blocking pod IMDS entirely and using scoped app credentials.
- If node-role access remains, restrict role permissions further by environment and by DynamoDB leading keys where practical.
- Add egress policy that only allows IMDS from workloads that strictly need it, and monitor IMDS access.

### High: Real Secrets and Terraform State Exist Locally in the Repo Directory

Evidence:

- `detect-secrets scan . --all-files` flagged `api/.env`, `infra/terraform/environments/aws/secret.auto.tfvars`, `terraform.tfstate`, and `terraform.tfstate.backup`.
- `git check-ignore` confirmed these are ignored by `.gitignore`, not tracked.
- `api/.env` contains values for `SESSION_SIGNING_SECRET`, `FOOTBALL_DATA_TOKEN`, and `API_FOOTBALL_KEY`.
- `infra/terraform/environments/aws/secret.auto.tfvars` contains `ssh_cidr` and `football_data_token`.
- Terraform state files are present under `infra/terraform/environments/aws/`.

Impact:

- These files are not committed, which is good, but they are still sensitive local artifacts.
- Terraform state can contain secret values and infrastructure identifiers.
- Local backups, shell history, editor indexing, or accidental copy operations can expose them.

Recommendation:

- Keep these files out of git, but also store Terraform state in a remote encrypted backend with locking.
- Remove local state files after migrating state.
- Add a committed `.secrets.baseline` or pre-commit hook so accidental future changes are caught before commit.
- Rotate any tokens if there is any chance these files were shared, synced, or committed before.

### Medium: Admin Token Endpoints Need Stronger Controls

Evidence:

- `api/src/routes/index.ts:106` exposes `POST /api/admin/player-of-tournament` with only `X-Admin-Token`.
- `api/src/routes/index.ts:114` exposes `GET /api/admin/feedback` with only `X-Admin-Token`.
- `api/src/services/playerOfTournament.ts:63-64` and `api/src/services/feedback.ts:55-56` compare token strings directly.
- These endpoints rely only on the global limiter, not a stricter admin limiter.

Impact:

- A weak or leaked admin token grants sensitive admin actions.
- Direct string comparison can leak tiny timing differences.
- There is no unified admin middleware or audit trail for admin actions.

Recommendation:

- Use a dedicated `requireAdmin` middleware.
- Require normal bearer auth plus a role check for admin actions, or use a strongly generated admin token only for emergency paths.
- Compare token hashes with `timingSafeEqual`.
- Apply a strict admin route limiter and structured audit logging.

### Medium: Browser Bearer Token Stored in `localStorage`

Evidence:

- `web/src/context/PlayerContext.tsx:20-44` stores the player session and bearer token in `localStorage`.
- `web/src/api/client.ts:93-104` sends that token in the `Authorization` header.
- `web/src/components/OnboardingTour.tsx:64-65` uses `dangerouslySetInnerHTML` for static tour content.
- `web/nginx.conf:1-16` does not set CSP or other static-site security headers.

Impact:

- Any XSS bug can read the bearer token and impersonate the user until expiry.
- Current `dangerouslySetInnerHTML` content comes from static local `web/src/tour.ts`, so it is not an immediate injection bug, but it increases future XSS risk if dynamic content is ever added.

Recommendation:

- Add a CSP at nginx/ingress level. Start with a restrictive policy and explicitly allow required image/API sources.
- Avoid `dangerouslySetInnerHTML`; render the few bold fragments as React nodes.
- Consider httpOnly secure cookies if the app evolves beyond a casual SPA.
- Add token revocation or shorter TTL if session theft becomes material.

### Medium: Static Web and Ingress Headers Are Incomplete

Evidence:

- `web/nginx.conf:1-16` only configures SPA fallback and asset cache headers.
- `infra/helm/wc2026/templates/ingress.yaml:8-18` configures cert-manager/TLS but no HTTP-to-HTTPS redirect, HSTS, CSP, referrer policy, or permissions policy annotations.
- `infra/terraform/modules/k3s/main.tf:30-43` exposes both HTTP and HTTPS publicly.

Impact:

- Users can potentially access the site over plain HTTP unless ingress/controller defaults force redirect.
- Missing headers reduce browser-side defense in depth.

Recommendation:

- Add ingress-nginx annotations for SSL redirect and HSTS.
- Add nginx headers for `Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`, and appropriate `Cache-Control` for `index.html`.

### Medium: Bootstrap Installs Remote Components Without Pinning or Checksum Verification

Evidence:

- `infra/terraform/modules/k3s/user-data.sh.tftpl:11-12` downloads and installs AWS CLI without a checksum check.
- `infra/terraform/modules/k3s/user-data.sh.tftpl:15` pipes `https://get.k3s.io` into shell.
- `infra/terraform/modules/k3s/user-data.sh.tftpl:20` pipes Helm's install script into shell.
- `infra/terraform/modules/k3s/user-data.sh.tftpl:25-32` installs latest ingress-nginx chart and ArgoCD stable manifests without version pinning.

Impact:

- Node bootstrap is sensitive supply chain surface.
- Rebuilding the node at a later date can deploy different component versions than originally reviewed.

Recommendation:

- Pin k3s, Helm, ingress-nginx, and ArgoCD versions.
- Verify checksums/signatures where available.
- Prefer checked-in manifests or pinned release URLs.

### Medium: Dev/Build Dependency Audit Finds `esbuild` Advisory

Evidence:

- `npm audit --omit=dev --audit-level=low --json` returned zero production vulnerabilities.
- `npm audit --audit-level=low --json` found one high-severity dev/build vulnerability for `esbuild`.
- `api/package.json:31` pins `esbuild` to `0.28.0`.
- `npm ls --workspaces` shows Vite also using `esbuild@0.28.0`.

Impact:

- This is build/dev tooling, not a runtime production dependency.
- It still matters for CI and developer machines because build tools run during package install/build.

Recommendation:

- Upgrade `esbuild` to `0.28.1` or later.
- Re-run `npm audit` and the build after the upgrade.

### Medium: Kubernetes Defaults Leave Some Runtime Hardening Gaps

Evidence:

- `infra/helm/wc2026/templates/deployment-web.yaml:36-39` sets `readOnlyRootFilesystem: false`.
- Neither API nor web deployment sets `automountServiceAccountToken: false`.
- `infra/helm/wc2026/templates/networkpolicy.yaml:22-30` allows all pods egress to any TCP/443 destination.

Impact:

- A compromised web pod has more filesystem write capability than necessary.
- Pods may receive Kubernetes API tokens they do not need.
- Broad egress makes exfiltration easier after compromise.

Recommendation:

- Set `automountServiceAccountToken: false` for web, API, and sync unless Kubernetes API access is required.
- Make nginx writable paths explicit with `emptyDir` volumes and set `readOnlyRootFilesystem: true`.
- Tighten egress where possible, or use VPC endpoints/proxy controls for AWS/provider traffic.

### Low: CI Has Broad Write Permission in the Image Job

Evidence:

- `.github/workflows/ci.yml:28-30` grants `contents: write` and `packages: write` to the image job.
- `.github/workflows/ci.yml:60-71` auto-commits a dev image tag update back to `main`.
- `.github/workflows/promote-to-prod.yml:13-19` correctly uses a production environment approval gate.

Impact:

- The dev auto-deploy workflow intentionally writes to `main`.
- If a workflow token is misused during a push run, it can modify repository contents within that job's permission scope.

Recommendation:

- Split image publishing and dev values updates into separate jobs with minimal permissions.
- Keep branch protection enabled for `main` and `release`.
- Consider a bot branch/PR for dev tag bumps if direct pushes become a concern.

### Low: Secret Scanners Produce Some False Positives

Evidence:

- `gitleaks detect --source . --verbose` found one `generic-api-key` match at `web/src/pages/FixturesPage.tsx:10`, value `wc2026.fixtures.hideFinished`.
- This appears to be a localStorage key, not a secret.
- `detect-secrets` also flagged static test constants, invite-code alphabet, Helm secret names, image tags, and generated/vendor files.

Recommendation:

- Add a reviewed baseline/allowlist for known false positives.
- Keep scanning generated folders excluded from routine developer scans.

## Positive Controls Observed

- API disables `x-powered-by` and uses Helmet: `api/src/server.ts:18-22`.
- Strict body size limit: `api/src/server.ts:24`.
- Global, login, and join rate limits: `api/src/middleware/index.ts:58-60`.
- Zod request validation on write paths: `api/src/routes/index.ts`.
- PIN hashes use salted `scrypt`: `api/src/lib/pin.ts:6-18`.
- Session signature verification uses `timingSafeEqual`: `api/src/lib/token.ts:31-34`.
- API error handler returns generic 500s: `api/src/middleware/index.ts:68-85`.
- Logger redacts common secret fields: `api/src/lib/logger.ts:5-23`.
- DynamoDB uses PITR and server-side encryption: `infra/terraform/modules/data/main.tf:46-51`.
- API/sync containers run non-root, drop capabilities, and use seccomp: `infra/helm/wc2026/templates/deployment-api.yaml:19-22,64-68` and `cronjob-sync.yaml:24-27,49-53`.
- Production promotion requires a GitHub environment approval gate: `.github/workflows/promote-to-prod.yml:17-19`.

## Commands Run

```bash
gitleaks detect --source . --verbose
detect-secrets scan . --all-files
detect-secrets scan api web packages infra --exclude-files '(^|/)(node_modules|dist)(/|$)' --exclude-files '\.tfstate(\.backup)?$' --all-files
npm audit --omit=dev --audit-level=low --json
npm audit --audit-level=low --json
```

Results:

- `gitleaks`: one likely false positive localStorage key.
- `detect-secrets`: real local ignored secret/state files plus false positives in generated/vendor/test/config names.
- Production dependency audit: zero vulnerabilities.
- Full dependency audit: one high-severity dev/build advisory in `esbuild@0.28.0`.

## Suggested Remediation Order

1. Replace display-name admin with stable role/player-id based admin.
2. Strengthen login beyond a 4-digit PIN or add per-account lockout/backoff.
3. Remove local Terraform state by migrating to encrypted remote state.
4. Reduce pod access to EC2 node credentials/IMDS.
5. Add CSP, HSTS, HTTPS redirect, and static-site security headers.
6. Upgrade `esbuild` and re-run audits/builds.
7. Pin bootstrap component versions and checksums.
8. Add a reviewed secret-scanning baseline and pre-commit/CI secret scan.
