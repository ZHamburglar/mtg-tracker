# MTG Tracker

Testing Action

## Feature Addition Timeline
- [ ] Horizontal Pod Autoscaling

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Next.js Client (mtg-tracker-client)                                 │   │
│  │  - React UI with TypeScript                                          │   │
│  │  - Port: 3000                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Ingress (ingress-nginx)                              │
│  - Routes: /api/auth/*, /api/bulk/*, /api/search/*, /api/collection/*,      │
│            /api/listing/*                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Microservices Layer                                │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Auth Service │  │ Bulk Service │  │Search Service│  │Collection Srv│   │
│  │              │  │              │  │              │  │              │   │
│  │ Port: 3000   │  │ Port: 3000   │  │ Port: 3000   │  │ Port: 3000   │   │
│  │              │  │              │  │              │  │              │   │
│  │ - User auth  │  │ - Card data  │  │ - Card search│  │ - User cards │   │
│  │ - New user   │  │ - Prices     │  │ - Search by  │  │ - Collection │   │
│  │   creation   │  │ - Sets       │  │   ID/name    │  │   mgmt       │   │
│  │              │  │ - Trending   │  │              │  │              │   │
│  │              │  │              │  │              │  │              │   │
│  │              │  │ Cron Jobs:   │  │              │  │              │   │
│  │              │  │ - 00:01 Card │  │              │  │              │   │
│  │              │  │   import     │  │              │  │              │   │
│  │              │  │ - 00:20 Sets │  │              │  │              │   │
│  │              │  │   (Sunday)   │  │              │  │              │   │
│  │              │  │ - 00:30      │  │              │  │              │   │
│  │              │  │   Trending   │  │              │  │              │   │
│  │              │  │              │  │              │  │              │   │
│  │ Resources:   │  │ Resources:   │  │ Resources:   │  │ Resources:   │   │
│  │ (default)    │  │ 2-3Gi RAM    │  │ (default)    │  │ (default)    │   │
│  │              │  │ 500m-1 CPU   │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                               │
│  ┌──────────────┐                                                            │
│  │Listing Svc   │                                                            │
│  │              │                                                            │
│  │ Port: 3000   │                                                            │
│  │              │                                                            │
│  │ - Card       │                                                            │
│  │   listings   │                                                            │
│  │ - Marketplace│                                                            │
│  │              │                                                            │
│  │ Resources:   │                                                            │
│  │ 512Mi-1Gi    │                                                            │
│  │ 250m-1 CPU   │                                                            │
│  └──────────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                     │
                    ▼                                     ▼
┌─────────────────────────────────────┐  ┌──────────────────────────────────┐
│        Message Queue (NATS)         │  │    Database Layer (MySQL 8.0)    │
│                                     │  │                                  │
│  - URL: nats://nats-srv:4222       │  │  - Host: mysql:3306              │
│  - Cluster ID: mtg-tracker         │  │  - Database: mtgtrackerdb        │
│  - JetStream enabled               │  │                                  │
│                                     │  │  Tables:                         │
│  Event-driven communication        │  │  - users                         │
│  between services                  │  │  - cards                         │
│                                     │  │  - card_prices                   │
│                                     │  │  - sets                          │
│                                     │  │  - trending_cards                │
│                                     │  │  - card_listings                 │
│                                     │  │  - collections                   │
│                                     │  │                                  │
│                                     │  │  StatefulSet:                    │
│                                     │  │  - 20Gi Longhorn PVC             │
│                                     │  │  - InnoDB buffer: 2GB            │
│                                     │  │  - Max connections: 200          │
│                                     │  │                                  │
│                                     │  │  Resources:                      │
│                                     │  │  - 3-4Gi RAM                     │
│                                     │  │  - 500m-2 CPU                    │
└─────────────────────────────────────┘  └──────────────────────────────────┘
                                                         │
                                                         ▼
                                         ┌──────────────────────────────────┐
                                         │   External Data Source           │
                                         │                                  │
                                         │  Scryfall API                    │
                                         │  - Card data import              │
                                         │  - Price data import             │
                                         │  - Set information               │
                                         └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        Observability Stack (Loki)                            │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │   Grafana    │  │   Loki 3.5.7 │  │Promtail 3.5.1│                      │
│  │   11.0.0     │  │              │  │              │                      │
│  │              │  │ SingleBinary │  │ DaemonSet    │                      │
│  │ Port: 3000   │  │ Gateway: 80  │  │              │                      │
│  │ LB: 192.168  │  │ Direct: 3100 │  │ Log collector│                      │
│  │   .1.170     │  │              │  │ from all pods│                      │
│  │              │  │ 10Gi PVC     │  │              │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│         │                  ▲                  │                              │
│         └──────────────────┴──────────────────┘                              │
│              (Log aggregation & visualization)                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      Infrastructure (Kubernetes)                             │
│                                                                               │
│  - 3-node cluster                                                            │
│  - Longhorn for persistent storage                                           │
│  - Skaffold for local development                                            │
│  - ArgoCD for image updates (GitOps)                                         │
│  - Namespace: default (services), loki (observability)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features
- **Microservices Architecture**: Independent services for auth, bulk operations, search, collections, and listings
- **Event-Driven**: NATS message queue for inter-service communication
- **Scheduled Jobs**: Automated daily card/price imports and trending calculations (cron-based)
- **Optimized Database**: MySQL with 2GB InnoDB buffer pool for high-performance queries
- **Centralized Logging**: Loki stack for log aggregation across all services
- **Container Orchestration**: Kubernetes with resource limits and health checks

## Running Locally

Create a single .env.local and create a symlink to each service.

`ls -la /mtg-tracker/ | grep -E "^.*\.env"`

Create an .env.local and then symlink for the .env.local in each of the service folders.

`cd /mtg-tracker && \
ln -sf "$(pwd)/.env.local" auth/.env.local && \
ln -sf "$(pwd)/.env.local" bulk/.env.local && \
ln -sf "$(pwd)/.env.local" search/.env.local && \
ln -sf "$(pwd)/.env.local" collection/.env.local && \
ln -sf "$(pwd)/.env.local" listing/.env.local && \
echo "Symlinks created successfully"`

### Need to Create the following Secrets
Currently the secrets are in "-secret.yaml" files for local development, but you might want to move them into secrets other in k8s.

`kubectl create secret generic mysql-secret --from-literal=MYSQL_ROOT_PASSWORD=supersecurepassword`

### Connecting to the DB

Run this in the terminal: `kubectl port-forward svc/mysql 3306:3306`