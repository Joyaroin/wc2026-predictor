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
  # No default: a forgotten value must fail the plan rather than open port 22 to 0.0.0.0/0.
  # Set to your own IP/CIDR (e.g. "203.0.113.4/32"). SSM Session Manager works without SSH.
  description = "CIDR allowed to SSH (port 22). REQUIRED — restrict to your IP, or use SSM only."
  type        = string
  validation {
    # Reject malformed CIDRs and any range broader than /8 (blocks 0.0.0.0/0, 0.0.0.0/1, etc. —
    # not just the exact all-internet string). try() keeps a non-CIDR value from erroring here.
    condition     = can(cidrhost(var.ssh_cidr, 0)) && try(tonumber(split("/", var.ssh_cidr)[1]) >= 8, false)
    error_message = "ssh_cidr must be a valid CIDR no broader than /8 (do not open SSH to the whole/half internet, e.g. 0.0.0.0/0 or 0.0.0.0/1)."
  }
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
variable "repo_raw_base" {
  type    = string
  default = "https://raw.githubusercontent.com/Joyaroin/wc2026-predictor/main"
}
variable "tags" {
  type    = map(string)
  default = { Project = "wc2026" }
}
