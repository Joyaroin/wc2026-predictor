variable "role_name" {
  type = string
}
variable "oidc_provider_arn" {
  type = string
}
variable "oidc_provider" {
  description = "OIDC issuer host/path without https:// (EKS module 'oidc_provider' output)"
  type        = string
}
variable "namespace" {
  type = string
}
variable "service_account" {
  type    = string
  default = "wc2026-api"
}
variable "table_arn" {
  type = string
}
variable "tags" {
  type    = map(string)
  default = {}
}
