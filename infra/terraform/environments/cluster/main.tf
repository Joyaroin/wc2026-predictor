# Shared substrate: the EKS cluster + ECR repositories (one cluster hosts both dev & prod namespaces).
provider "aws" {
  region = var.region
}

module "eks" {
  source             = "../../modules/eks"
  cluster_name       = var.cluster_name
  kubernetes_version = var.kubernetes_version
  tags               = var.tags
}

module "ecr" {
  source = "../../modules/ecr"
  tags   = var.tags
}

output "cluster_name" {
  value = module.eks.cluster_name
}
output "oidc_provider_arn" {
  value = module.eks.oidc_provider_arn
}
output "oidc_provider" {
  value = module.eks.oidc_provider
}
output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}
