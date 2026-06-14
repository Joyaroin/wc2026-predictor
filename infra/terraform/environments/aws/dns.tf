# DNS for the custom domain. The hosted zone is created by Route53 domain registration;
# we just add A records pointing apex + dev at the k3s node's Elastic IP.
# (ArgoCD is NOT exposed via DNS — reach it through `kubectl port-forward`, see infra/README.md.)
data "aws_route53_zone" "this" {
  name = var.domain
}

resource "aws_route53_record" "apex" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.domain
  type    = "A"
  ttl     = 300
  records = [module.k3s.public_ip]
}

resource "aws_route53_record" "dev" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "dev.${var.domain}"
  type    = "A"
  ttl     = 300
  records = [module.k3s.public_ip]
}

output "domain_urls" {
  value = {
    prod = "https://${var.domain}"
    dev  = "https://dev.${var.domain}"
  }
}
