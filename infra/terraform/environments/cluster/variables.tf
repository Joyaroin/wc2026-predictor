variable "region" {
  type    = string
  default = "us-east-1"
}
variable "cluster_name" {
  type    = string
  default = "wc2026"
}
variable "kubernetes_version" {
  type    = string
  default = "1.31"
}
variable "tags" {
  type    = map(string)
  default = { Project = "wc2026" }
}
