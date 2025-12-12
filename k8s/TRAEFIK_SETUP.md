# Traefik Setup Instructions

## 1. Install Traefik Ingress Controller

```bash
# Add Traefik Helm repository
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Install Traefik
helm install traefik traefik/traefik \
  --namespace traefik \
  --create-namespace \
  --set ports.web.redirectTo.port=websecure \
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

## Rollback (if needed)

```bash
# Uninstall Traefik
helm uninstall traefik -n traefik

# Reinstall NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```
