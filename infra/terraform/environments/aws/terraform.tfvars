region        = "us-east-1"
instance_type = "t4g.small" # bump to t4g.medium if dev+prod+ArgoCD are tight on RAM
# Sensitive values (ssh_cidr = your IP, football_data_token) live in the git-ignored
# secret.auto.tfvars so they're never published. Terraform auto-loads *.auto.tfvars.
# ssh_cidr defaults to 0.0.0.0/0 if not overridden — set your IP in secret.auto.tfvars.
