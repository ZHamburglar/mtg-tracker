# Traefik Setup Instructions

## 1. Install Traefik Ingress Controller

```bash
# Add Traefik Helm repository
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Check for existing Traefik installation
helm list -A | grep traefik

# If Traefik exists in kube-system, uninstall it first:
helm uninstall traefik -n kube-system

# Also clean up the IngressClass if it exists
kubectl delete ingressclass traefik

# Now install Traefik in the traefik namespace
helm install traefik traefik/traefik \
  --namespace traefik \
  --create-namespace \
  --set ports.websecure.tls.enabled=true \
  --set logs.access.enabled=true
```

## 2. Apply Middleware Configuration

```bash
kubectl apply -f k8s/traefik-middleware.yaml
```

## 3. Apply Ingress Configuration

```bash
kubectl apply -f k8s/mtg-tracker-ingress-srv.yaml
```

## 4. Verify Installation

```bash
# Check Traefik pods
kubectl get pods -n traefik

# Check ingress
kubectl get ingress

# Check middleware
kubectl get middleware
```

## 5. Access Dashboard (Optional)

```bash
# Port forward to access Traefik dashboard
kubectl port-forward -n traefik $(kubectl get pods -n traefik --selector "app.kubernetes.io/name=traefik" --output=name) 9000:9000
```

Then visit: http://localhost:9000/dashboard/

## Migration Notes

- NGINX annotations have been converted to Traefik equivalents
- CORS is now handled via Middleware CRD
- HTTPS redirect is configured via Middleware
- All routes remain the same
- cert-manager integration unchanged

## Post-Installation Steps

### Update /etc/hosts

Your Traefik LoadBalancer IP is different from NGINX. Update your hosts file:

```bash
# Check Traefik's external IP
kubectl get svc -n traefik traefik -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Edit your hosts file (macOS/Linux)
sudo nano /etc/hosts

# Change the IP for mtg-tracker.local to match Traefik's IP
# Example: 192.168.1.171 mtg-tracker.local
```

### Remove Old NGINX Ingress Controller

Once you've verified Traefik is working:

```bash
# Delete NGINX ingress controller
kubectl delete namespace ingress-nginx

# Or if installed via Helm:
helm uninstall ingress-nginx -n ingress-nginx
```

## Rollback (if needed)

```bash
# Uninstall Traefik
helm uninstall traefik -n traefik

# Reinstall NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```
