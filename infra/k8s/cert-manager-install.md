# Installing cert-manager on the running cluster

The node bootstrap (`infra/terraform/modules/k3s/user-data.sh.tftpl`) now installs
cert-manager and applies the `letsencrypt-prod` ClusterIssuer automatically **on a fresh
node**. The existing EC2 instance has `lifecycle { ignore_changes = [user_data] }`, so that
bootstrap change will **not** run on the node that is already up. Apply it once by hand.

## One-time, on the live k3s node

SSH in via SSM Session Manager (no SSH key needed), then:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 1. Install cert-manager (idempotent; skip if already present)
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  -n cert-manager --create-namespace \
  --set crds.enabled=true \
  --wait --timeout 5m

# 2. Create the ClusterIssuer the ingress references
kubectl apply -f https://raw.githubusercontent.com/Joyaroin/wc2026-predictor/main/infra/k8s/cluster-issuer.yaml

# 3. Watch certificates get issued (one per ingress host)
kubectl get certificate -A -w
```

`Ready=True` on each Certificate means Let's Encrypt issued the cert and the ingress is
serving real HTTPS. If a cert stays `False`, describe it and its CertificateRequest /
Order / Challenge to see the ACME failure:

```bash
kubectl describe certificate -n wc2026-prod wc2026-prod-tls
kubectl get challenge -A
```

## Already installed?

If cert-manager is already running on the cluster (the site is serving HTTPS today), only
step 2 is needed to bring the issuer under version control. Steps 1 and 3 are safe to run
regardless; `helm install` will error harmlessly if the release already exists (use
`helm upgrade --install` to be fully idempotent).
