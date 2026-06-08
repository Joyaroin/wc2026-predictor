# IAM role for the api ServiceAccount (IRSA), scoped to a single DynamoDB table (SECURITY-06).
data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${var.service_account}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:TransactWriteItems",
      "dynamodb:TransactGetItems",
    ]
    # Scoped to this env's table and its indexes only — no wildcards across tables.
    resources = [
      var.table_arn,
      "${var.table_arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "dynamodb" {
  name   = "${var.role_name}-dynamodb"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.dynamodb.json
}
