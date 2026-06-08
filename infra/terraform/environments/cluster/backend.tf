# Remote state (recommended). Fill in your state bucket + lock table, then `terraform init`.
# terraform {
#   backend "s3" {
#     bucket         = "my-tf-state-bucket"
#     key            = "wc2026/cluster/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "my-tf-lock-table"
#     encrypt        = true
#   }
# }
