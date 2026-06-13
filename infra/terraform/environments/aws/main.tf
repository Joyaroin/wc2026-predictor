# Cheap public Kubernetes on AWS: one k3s EC2 node + DynamoDB tables (dev/prod) + the app secret in SSM.
provider "aws" {
  region = var.region
}

module "data_dev" {
  source     = "../../modules/data"
  table_name = "wc2026-dev"
  tags       = merge(var.tags, { Environment = "dev" })
}

module "data_prod" {
  source     = "../../modules/data"
  table_name = "wc2026-prod"
  tags       = merge(var.tags, { Environment = "prod" })
}

# Football-data.org token, stored encrypted. Provide the value via TF_VAR_football_data_token.
resource "aws_ssm_parameter" "football_token" {
  name  = "/wc2026/football-data-token"
  type  = "SecureString"
  value = var.football_data_token
  tags  = var.tags
}

module "k3s" {
  source                = "../../modules/k3s"
  name                  = "wc2026-k3s"
  region                = var.region
  instance_type         = var.instance_type
  ssh_cidr              = var.ssh_cidr
  key_name              = var.key_name
  table_arns            = [module.data_dev.table_arn, module.data_prod.table_arn]
  secret_parameter_arns = [aws_ssm_parameter.football_token.arn]
  football_ssm_param    = aws_ssm_parameter.football_token.name
  repo_raw_base         = var.repo_raw_base
  tags                  = var.tags
}

output "public_ip" {
  value = module.k3s.public_ip
}
output "app_url_dev" {
  description = "Set this as ingress.host in values-dev.yaml (without http://)."
  value       = "http://${module.k3s.nip_io_host_dev}"
}
output "app_url_prod" {
  value = "http://${module.k3s.nip_io_host_prod}"
}
output "dev_table" {
  value = module.data_dev.table_name
}
output "prod_table" {
  value = module.data_prod.table_name
}
