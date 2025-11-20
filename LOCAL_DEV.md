# Local Development Setup

This guide shows how to run the collection service locally while connecting to the deployed MySQL database and other services at `https://mtg-tracker.local/`.

## Prerequisites

1. **kubectl** configured with access to your cluster
2. **Node.js** and **npm** installed
3. **Deployed services** running at `mtg-tracker.local`

## Setup Steps

### 1. Install Dependencies

```bash
cd /mtg-tracker/collection
npm install dotenv
```

### 2. Port Forward MySQL from Kubernetes

In a **separate terminal**, run:

```bash
kubectl port-forward svc/mysql 3306:3306
```

This forwards the MySQL service from your Kubernetes cluster to `localhost:3306`.

**Keep this terminal running** while you develop locally.

### 3. Configure Environment Variables

The `.env.local` file is already created with these settings:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=mtguser
MYSQL_PASSWORD=mtgpassword123
MYSQL_DATABASE=mtgtrackerdb
PORT=3001

# Other deployed services
AUTH_SERVICE_URL=https://mtg-tracker.local/api/users
SEARCH_SERVICE_URL=https://mtg-tracker.local/api/search
BULK_SERVICE_URL=https://mtg-tracker.local/api/bulk
```

**Note:** The service will run on port `3001` locally to avoid conflicts.

### 4. Start the Service Locally

```bash
npm run dev:local
```

You should see:
```
Collection service up and running!!
Attempting MySQL connection...
MySQL pool connected successfully!
Listening on port 3001!
```

### 5. Test the Service

```bash
# Health check
curl http://localhost:3001/api/health

# Your collection endpoints
curl http://localhost:3001/api/collection/...
```

## How It Works

### MySQL Connection
- **In Kubernetes:** Services connect to `mysql` (service name) on port 3306
- **Locally:** Service connects to `localhost:3306` (port-forwarded from k8s)
- The `mysql.ts` config now reads from `MYSQL_HOST` environment variable

### Other Services
- Your local service can call deployed services at `https://mtg-tracker.local/`
- Use axios or fetch with the service URLs from `.env.local`:
  ```typescript
  import axios from 'axios';
  
  const authUrl = process.env.AUTH_SERVICE_URL || 'https://mtg-tracker.local/api/users';
  const response = await axios.get(`${authUrl}/currentuser`);
  ```

### Port Configuration
- **Deployed:** Port 3000 (inside containers)
- **Local:** Port 3001 (configurable via `PORT` env var)

## Troubleshooting

### MySQL Connection Failed
**Problem:** `MySQL connection failed. Retries left: X`

**Solutions:**
1. Verify port-forward is running:
   ```bash
   kubectl port-forward svc/mysql 3306:3306
   ```

2. Check MySQL is running in cluster:
   ```bash
   kubectl get pods | grep mysql
   ```

3. Verify credentials match the secret:
   ```bash
   kubectl get secret mysql-secret -o yaml
   ```

### Port Already in Use
**Problem:** `Error: listen EADDRINUSE: address already in use :::3001`

**Solution:** Change the port in `.env.local`:
```env
PORT=3002
```

### Cannot Reach Other Services
**Problem:** Cannot connect to `https://mtg-tracker.local/`

**Solutions:**
1. Verify `/etc/hosts` has the entry:
   ```bash
   cat /etc/hosts | grep mtg-tracker
   ```
   Should show: `127.0.0.1 mtg-tracker.local`

2. Check ingress is running:
   ```bash
   kubectl get ingress
   ```

3. Test deployed services:
   ```bash
   curl https://mtg-tracker.local/api/search/health
   ```

## Development Workflow

### Making Code Changes
1. Edit files in `src/`
2. `ts-node-dev` will automatically restart the service
3. Test your changes at `http://localhost:3001`

### Testing with Deployed Services
```bash
# Your local service
curl http://localhost:3001/api/collection/...

# Deployed search service
curl https://mtg-tracker.local/api/search?name=Lightning

# Deployed auth service
curl https://mtg-tracker.local/api/users/currentuser
```

### Switching Back to Deployment
When you're ready to deploy your changes:

```bash
# Build and push Docker image
docker build -t yourusername/mtg-tracker-collection:latest .
docker push yourusername/mtg-tracker-collection:latest

# Apply Kubernetes deployment
kubectl apply -f ../k8s/collection-depl.yaml

# Or use Skaffold
skaffold dev
```

## Environment Variables Reference

| Variable | Local Value | Deployed Value | Description |
|----------|-------------|----------------|-------------|
| `MYSQL_HOST` | `localhost` | `mysql` | MySQL hostname |
| `MYSQL_PORT` | `3306` | `3306` | MySQL port |
| `MYSQL_USER` | `mtguser` | `mtguser` | Database user |
| `MYSQL_PASSWORD` | `mtgpassword123` | `mtgpassword123` | Database password |
| `MYSQL_DATABASE` | `mtgtrackerdb` | `mtgtrackerdb` | Database name |
| `PORT` | `3001` | `3000` | Service port |

## Quick Reference

```bash
# Start port-forward (separate terminal)
kubectl port-forward svc/mysql 3306:3306

# Run locally
npm run dev:local

# Stop port-forward
# Press Ctrl+C in port-forward terminal

# Check logs
# Watch the terminal where npm run dev:local is running
```

## Tips

1. **Keep port-forward running** - Don't close that terminal
2. **Use different port locally** - Avoids conflicts with other services
3. **Check deployed services** - Make sure they're healthy before testing integrations
4. **Use .env.local** - Never commit this file (it's in .gitignore)
5. **Database changes persist** - Changes made locally affect the deployed database

## Security Note

⚠️ This setup connects to your **production/deployed database**. Any changes you make locally will affect the deployed data. For testing destructive operations, consider:

1. Creating a separate test database
2. Using database transactions that can be rolled back
3. Taking database backups before testing
