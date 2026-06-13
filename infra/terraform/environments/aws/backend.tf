# Remote state (S3) with encryption + native state locking.
#
# WHY THIS MATTERS: with a local backend, terraform.tfstate is written to disk in PLAINTEXT
# and includes sensitive values (e.g. the football-data.org token), and there is no locking
# (concurrent applies can corrupt state). A remote S3 backend with encryption + locking fixes
# both. This block is ENABLED, but the bucket/key/region below are PLACEHOLDERS.
#
# SCOPED-DOWN: do NOT `terraform init` until you replace the placeholders with a real,
# pre-created, PRIVATE, versioned S3 bucket you own. Changing the backend on an existing
# workspace requires a state migration (`terraform init -migrate-state`).
#
# Prerequisites (create once, out of band):
#   - An S3 bucket: versioned, encrypted (SSE), public access fully blocked.
#   - `use_lockfile = true` uses S3-native conditional-write locking (Terraform >= 1.10),
#     so no separate DynamoDB lock table is required.
terraform {
  backend "s3" {
    bucket       = "REPLACE_ME-wc2026-tfstate" # TODO: set to your private, versioned S3 bucket name
    key          = "wc2026/aws/terraform.tfstate"
    region       = "us-east-1" # TODO: set to the bucket's region
    encrypt      = true        # encrypt state at rest (SSE)
    use_lockfile = true        # S3-native state locking (Terraform >= 1.10); no DynamoDB table needed
  }
}
