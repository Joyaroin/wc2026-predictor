terraform {
  # >= 1.10 required for the S3 backend's native `use_lockfile` state locking (see backend.tf).
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}
