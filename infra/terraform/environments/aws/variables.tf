variable "region" {
  type    = string
  default = "us-east-1"
}
variable "instance_type" {
  description = "t4g.small (~$12/mo) or t4g.medium (~$24/mo, recommended for dev+prod+ArgoCD)."
  type        = string
  default     = "t4g.small"
}
variable "ssh_cidr" {
  type    = string
  default = "0.0.0.0/0"
}
variable "key_name" {
  type    = string
  default = null
}
variable "football_data_token" {
  description = "football-data.org token. Provide via TF_VAR_football_data_token (do NOT commit)."
  type        = string
  sensitive   = true
}
variable "domain" {
  description = "Registered domain (hosted zone must exist in this account)."
  type        = string
  default     = "wc-predictions-2026.com"
}
variable "repo_url" {
  type    = string
  default = "https://github.com/Joyaroin/wc2026-predictor.git"
}
variable "repo_raw_base" {
  type    = string
  default = "https://raw.githubusercontent.com/Joyaroin/wc2026-predictor/main"
}
variable "tags" {
  type    = map(string)
  default = { Project = "wc2026" }
}
