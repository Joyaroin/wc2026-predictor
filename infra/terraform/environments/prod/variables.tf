variable "region" {
  type    = string
  default = "us-east-1"
}
variable "oidc_provider_arn" {
  description = "From `cluster` env output oidc_provider_arn"
  type        = string
}
variable "oidc_provider" {
  description = "From `cluster` env output oidc_provider"
  type        = string
}
variable "tags" {
  type    = map(string)
  default = { Project = "wc2026" }
}
