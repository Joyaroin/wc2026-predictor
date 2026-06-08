output "cluster_name" {
  value = module.eks.cluster_name
}
output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}
output "cluster_certificate_authority_data" {
  value = module.eks.cluster_certificate_authority_data
}
output "oidc_provider_arn" {
  value = module.eks.oidc_provider_arn
}
output "oidc_provider" {
  # OIDC issuer URL without the https:// scheme (used in IRSA trust conditions).
  value = module.eks.oidc_provider
}
output "vpc_id" {
  value = module.vpc.vpc_id
}
