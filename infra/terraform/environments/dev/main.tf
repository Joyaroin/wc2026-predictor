# dev environment: DynamoDB table + IRSA role for namespace wc2026-dev.
# OIDC inputs come from the `cluster` environment outputs (pass via terraform.tfvars).
provider "aws" {
  region = var.region
}

module "data" {
  source     = "../../modules/data"
  table_name = "wc2026-dev"
  tags       = merge(var.tags, { Environment = "dev" })
}

module "irsa" {
  source            = "../../modules/irsa"
  role_name         = "wc2026-dev-api"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_provider     = var.oidc_provider
  namespace         = "wc2026-dev"
  service_account   = "wc2026-api"
  table_arn         = module.data.table_arn
  tags              = merge(var.tags, { Environment = "dev" })
}

output "table_name" {
  value = module.data.table_name
}
output "irsa_role_arn" {
  value = module.irsa.role_arn
}
