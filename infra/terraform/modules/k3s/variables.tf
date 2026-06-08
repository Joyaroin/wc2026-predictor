variable "name" {
  type    = string
  default = "wc2026-k3s"
}
variable "region" {
  type = string
}
variable "instance_type" {
  description = "t4g.small (~$12/mo, 2GB) fits one env; t4g.medium (~$24/mo, 4GB) recommended for dev+prod+ArgoCD."
  type        = string
  default     = "t4g.small"
}
variable "ssh_cidr" {
  description = "CIDR allowed to SSH (port 22). Default open; restrict to your IP. SSM Session Manager works regardless."
  type        = string
  default     = "0.0.0.0/0"
}
variable "key_name" {
  description = "Optional EC2 key pair name for SSH (null = use SSM Session Manager only)."
  type        = string
  default     = null
}
variable "table_arns" {
  description = "DynamoDB table ARNs the node may access."
  type        = list(string)
}
variable "secret_parameter_arns" {
  description = "SSM parameter ARNs the node may read (app secrets)."
  type        = list(string)
}
variable "repo_url" {
  type    = string
  default = "https://github.com/Joyaroin/wc2026-predictor.git"
}
variable "repo_raw_base" {
  description = "Raw base URL for applying the GitOps bootstrap manifests."
  type        = string
  default     = "https://raw.githubusercontent.com/Joyaroin/wc2026-predictor/main"
}
variable "football_ssm_param" {
  description = "SSM parameter name holding the football-data.org token."
  type        = string
}
variable "namespaces" {
  type    = string
  default = "wc2026-dev wc2026-prod"
}
variable "tags" {
  type    = map(string)
  default = {}
}
