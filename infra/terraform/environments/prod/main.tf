# prod environment: DynamoDB table + IRSA role for namespace wc2026-prod.
provider "aws" {
  region = var.region
}

module "data" {
  source     = "../../modules/data"
  table_name = "wc2026-prod"
  tags       = merge(var.tags, { Environment = "prod" })
}

module "irsa" {
  source            = "../../modules/irsa"
  role_name         = "wc2026-prod-api"
  oidc_provider_arn = var.oidc_provider_arn
  oidc_provider     = var.oidc_provider
  namespace         = "wc2026-prod"
  service_account   = "wc2026-api"
  table_arn         = module.data.table_arn
  tags              = merge(var.tags, { Environment = "prod" })
}

output "table_name" {
  value = module.data.table_name
}
output "irsa_role_arn" {
  value = module.irsa.role_arn
}
