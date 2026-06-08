# Remote state (recommended). Uncomment + fill in, then `terraform init`.
# terraform {
#   backend "s3" {
#     bucket         = "my-tf-state-bucket"
#     key            = "wc2026/prod/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "my-tf-lock-table"
#     encrypt        = true
#   }
# }
