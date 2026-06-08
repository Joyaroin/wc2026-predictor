variable "cluster_name" {
  type    = string
  default = "wc2026"
}
variable "kubernetes_version" {
  type    = string
  default = "1.31"
}
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}
variable "private_subnets" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}
variable "public_subnets" {
  type    = list(string)
  default = ["10.0.101.0/24", "10.0.102.0/24"]
}
variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}
variable "node_min_size" {
  type    = number
  default = 1
}
variable "node_max_size" {
  type    = number
  default = 4
}
variable "node_desired_size" {
  type    = number
  default = 2
}
variable "tags" {
  type    = map(string)
  default = {}
}
