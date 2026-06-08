region        = "us-east-1"
instance_type = "t4g.small" # bump to t4g.medium if dev+prod+ArgoCD are tight on RAM
# Restrict SSH to your IP, e.g. "203.0.113.4/32" (SSM Session Manager works regardless).
ssh_cidr = "0.0.0.0/0"
# football_data_token: do NOT put it here. Pass at apply time:
#   TF_VAR_football_data_token=xxxx terraform apply
