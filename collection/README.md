# Quick Start - Local Development

Run the collection service locally while connecting to deployed services.

## Option 1: Automated Setup (Recommended)

```bash
./local-dev.sh
```

Select option `1` to start port-forward and run the service.

## Option 2: Manual Setup

### Terminal 1 - Port Forward MySQL
```bash
kubectl port-forward svc/mysql 3306:3306
```

### Terminal 2 - Run Service
```bash
npm run dev:local
```

## Access Your Service

- **Local service:** http://localhost:3001
- **Deployed services:** https://mtg-tracker.local/

## Stop Development

Press `Ctrl+C` in both terminals.

## Troubleshooting

See [LOCAL_DEV.md](./LOCAL_DEV.md) for detailed troubleshooting.

### Quick Fixes

**Port 3306 in use?**
```bash
lsof -ti:3306 | xargs kill -9
```

**Can't connect to MySQL?**
```bash
kubectl get pods | grep mysql
kubectl get svc mysql
```

**Local service port conflict?**
Edit `.env.local` and change `PORT=3001` to another port.
