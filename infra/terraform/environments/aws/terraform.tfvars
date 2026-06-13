region        = "us-east-1"
instance_type = "t4g.small" # bump to t4g.medium if dev+prod+ArgoCD are tight on RAM
# Sensitive values (ssh_cidr = your IP, football_data_token) live in the git-ignored
# secret.auto.tfvars so they're never published. Terraform auto-loads *.auto.tfvars.
# ssh_cidr is now REQUIRED (no default) — you MUST set it in secret.auto.tfvars, e.g.
#   ssh_cidr = "203.0.113.4/32"
# Omitting it fails the plan instead of opening port 22 to the world. (Use SSM to skip SSH.)
