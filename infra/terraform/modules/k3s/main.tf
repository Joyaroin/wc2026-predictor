# A single EC2 instance running k3s (lightweight Kubernetes) — the cheap, public cluster.
# Pods reach DynamoDB via this instance's IAM role (no static keys, no IRSA).

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Amazon Linux 2023, arm64 (for cheap Graviton t4g instances).
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023*-arm64"]
  }
}

resource "aws_security_group" "k3s" {
  name_prefix = "${var.name}-"
  description = "k3s node: web (80/443) public, SSH restricted"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "SSH (restrict to your IP)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags

  # Standard companion to name_prefix: create the replacement SG (with a fresh generated name)
  # before destroying the old one, so the rule set can change without an in-use-name conflict.
  lifecycle {
    create_before_destroy = true
  }
}

# --- IAM: instance role with scoped DynamoDB + SSM read (for secrets) + SSM Session Manager ---
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name               = "${var.name}-node"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "node" {
  # TRADEOFF (single-node design, accepted): this one instance role grants access to BOTH the
  # dev and prod DynamoDB tables (var.table_arns = [dev, prod]). Because dev and prod pods run
  # on the SAME k3s node and share the EC2 instance role, there is no IAM-level isolation between
  # environments — a compromised dev pod could reach the prod table. This is inherent to the
  # cheap single-node topology. Proper isolation needs separate nodes (or IRSA + per-env roles);
  # do NOT rearchitect here. Mitigations in place: per-namespace NetworkPolicy, distinct table
  # names, and app-level TABLE_NAME scoping. Revisit if prod data sensitivity grows.
  statement {
    sid    = "DynamoDB"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem",
      "dynamodb:Query", "dynamodb:Scan", "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem",
      "dynamodb:TransactWriteItems", "dynamodb:TransactGetItems",
    ]
    resources = concat(var.table_arns, [for arn in var.table_arns : "${arn}/index/*"])
  }
  statement {
    sid       = "ReadSecrets"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = var.secret_parameter_arns
  }
}

resource "aws_iam_role_policy" "node" {
  name   = "${var.name}-policy"
  role   = aws_iam_role.node.id
  policy = data.aws_iam_policy_document.node.json
}

# Session Manager access (so you can shell in without an SSH key).
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.name}-node"
  role = aws_iam_role.node.name
}

resource "aws_instance" "k3s" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.k3s.id]
  iam_instance_profile        = aws_iam_instance_profile.node.name
  associate_public_ip_address = true
  key_name                    = var.key_name

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    region             = var.region
    repo_raw_base      = var.repo_raw_base
    football_ssm_param = var.football_ssm_param
    namespaces         = var.namespaces
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  # Never replace the running node on AMI/user-data drift (re-bootstrap is destructive).
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  tags = merge(var.tags, { Name = var.name })
}

# Stable public IP (free while attached to a running instance).
resource "aws_eip" "k3s" {
  instance = aws_instance.k3s.id
  tags     = var.tags
}
