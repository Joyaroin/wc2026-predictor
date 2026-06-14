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
  # No default on purpose: a forgotten value should FAIL the plan, not silently open port 22
  # to the entire internet. Set it to your own IP/CIDR (e.g. "203.0.113.4/32").
  # You usually don't need SSH at all — SSM Session Manager works without it (no open port 22).
  description = "CIDR allowed to SSH (port 22). REQUIRED. Use SSM Session Manager to avoid SSH entirely."
  type        = string
  validation {
    condition     = can(cidrhost(var.ssh_cidr, 0)) && var.ssh_cidr != "0.0.0.0/0"
    error_message = "ssh_cidr must be a valid CIDR and must not be 0.0.0.0/0 (do not open SSH to the entire internet)."
  }
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
