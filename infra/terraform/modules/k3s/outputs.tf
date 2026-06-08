output "public_ip" {
  value = aws_eip.k3s.public_ip
}
output "instance_id" {
  value = aws_instance.k3s.id
}
output "nip_io_host_dev" {
  description = "Suggested no-domain hostname for dev (set in values-dev.yaml ingress.host)."
  value       = "dev.${replace(aws_eip.k3s.public_ip, ".", "-")}.nip.io"
}
output "nip_io_host_prod" {
  value = "${replace(aws_eip.k3s.public_ip, ".", "-")}.nip.io"
}
