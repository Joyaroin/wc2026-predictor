# Security Test Instructions

## Purpose
Validate the Security Baseline controls that are practical at build time.

## Automated Checks

### Dependency Audit
```bash
npm audit --omit=dev
```

Expected result:
- `found 0 vulnerabilities`

### Auth and Authorization Tests
```bash
npm run test --workspace @wc2026/api
```

Covered controls:
- PIN format validation.
- PIN stored as a scrypt hash.
- Wrong PIN rejected.
- Session token required for protected routes.
- Object-level group access enforced.
- Creator-only group deletion.
- Current PIN required for PIN change.

### Input Validation
```bash
npm test
```

Covered controls:
- Shared Zod schemas.
- Score bounds.
- HTTP request validation.
- Mapper round-trip property tests.

### Container and Kubernetes Hardening
```bash
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-prod.yaml
```

Review rendered manifests for:
- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- dropped capabilities
- `seccompProfile: RuntimeDefault`
- secret references instead of inline secret values
- network policy present

## Manual Pre-Deploy Checks
- Confirm GHCR packages are public or configure image pull credentials.
- Confirm no real secrets are committed.
- Confirm `TF_VAR_football_data_token` is supplied from the shell only.
- Confirm AWS IAM user/role has only the permissions required for Terraform deployment.
