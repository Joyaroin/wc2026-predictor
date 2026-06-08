variable "repositories" {
  type    = list(string)
  default = ["wc2026/api", "wc2026/web"]
}
variable "tags" {
  type    = map(string)
  default = {}
}
