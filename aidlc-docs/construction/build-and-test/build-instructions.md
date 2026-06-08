# Build Instructions

## Prerequisites
- **Node.js**: 22 or newer.
- **npm**: included with Node 22.
- **Terraform**: 1.14.8 verified locally.
- **Helm**: v4.1.4 verified locally.
- **Docker**: 29.3.1 verified locally for image builds.
- **AWS CLI**: required for deployment, not required for local build/test.

## Environment Variables
- `TF_VAR_football_data_token`: required for `terraform apply`; stored in AWS SSM as `/wc2026/football-data-token`.
- `AWS_PROFILE` or default AWS CLI credentials: required for Terraform deployment.
- `FOOTBALL_DATA_TOKEN`: required when running the real sync job locally or in production.
- `SESSION_SIGNING_SECRET`: required for production API sessions; generated into the cluster secret by the k3s bootstrap.

Do not commit real secrets. Local examples belong in git-ignored `.env` files.

## Build Steps

### 1. Install Dependencies
```bash
npm ci
```

### 2. Build All Workspaces
```bash
npm run build
```

Expected result:
- `@wc2026/shared` TypeScript build emits `packages/shared/dist`.
- `@wc2026/api` TypeScript build passes with `--noEmit`.
- `@wc2026/web` TypeScript build passes and Vite emits `web/dist`.

### 3. Build API Deployment Bundles
```bash
npm run build:server --workspace @wc2026/api
```

Expected artifacts:
- `api/dist/server.cjs`
- `api/dist/sync.cjs`

### 4. Validate Helm Manifests
```bash
helm lint infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
helm lint infra/helm/wc2026 -f infra/helm/wc2026/values-prod.yaml
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-dev.yaml
helm template wc2026 infra/helm/wc2026 -f infra/helm/wc2026/values-prod.yaml
```

### 5. Validate Terraform
```bash
terraform -chdir=infra/terraform/environments/aws init -backend=false
terraform -chdir=infra/terraform/environments/aws validate
```

### 6. Local Container Build
Requires a running Docker daemon:

```bash
docker build -f api/Dockerfile -t wc2026/api .
docker build -f web/Dockerfile --build-arg VITE_API_URL="" -t wc2026/web .
```

CI builds and pushes the deployable GHCR images on pushes to `main` and `release`.

## Troubleshooting

### API tests fail with `listen EPERM`
The sandbox blocks local ephemeral port binding. Run `npm test` from a normal terminal or with sandbox escalation.

### `npm audit` cannot resolve `registry.npmjs.org`
The sandbox blocks registry network access. Run from a normal terminal or with network approval.

### Terraform provider schema fails to load
The sandbox can prevent the AWS provider plugin from launching. Run Terraform validation from a normal terminal.

### Docker build cannot connect to the daemon
Start Docker Desktop, then rerun the Docker build commands.
