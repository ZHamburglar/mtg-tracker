# MTG Tracker

Testing Action

## Feature Addition Timeline
- [x] Horizontal Pod Autoscaling - 11/25/25
- [x] Health Checks - 11/25/25
- [x] Pino Log for Loki Grafana - 11/26/25
- [x] Redis Caching on Trending 24h/7d USD calls - 11/27/25
- [ ] Rate Limiting
- [ ] Auth Enforcement
- [ ] Monitoring and Alerting
- [ ] Connection Pool Management and Logging
- [ ] Input validations
- [ ] Metrics: Request rates
- [ ] Metrics: Error rate (%failed requests)
- [ ] Metrics: Response times (p50, p95, p99)
- [ ] Metrics: Concurrent requests

## Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Client["Next.js Client<br/>React UI with TypeScript<br/>Port: 3000"]
    end

    subgraph "Ingress Layer"
        Ingress["Ingress Nginx<br/>Routes: /api/auth/*, /api/bulk/*,<br/>/api/search/*, /api/collection/*,<br/>/api/listing/*"]
    end

    subgraph "Microservices Layer"
        Auth["Auth Service<br/>Port: 3000<br/>━━━━━━━━━━<br/>User Authentication<br/>New User Creation<br/><br/>HPA: 1-3 replicas<br/>384Mi-768Mi RAM<br/>100m-500m CPU"]
        
        Bulk["Bulk Service<br/>Port: 3000<br/>━━━━━━━━━━<br/>Card Data Import<br/>Price Management<br/>Set Information<br/>Trending Calculation<br/><br/>Cron Jobs:<br/>• 00:01 - Sets Import<br/>• 00:10 - Cards Import<br/>• 00:30 - Trending Calc<br/><br/>HPA: 1-2 replicas<br/>2-3Gi RAM<br/>500m-1 CPU"]
        
        Search["Search Service<br/>Port: 3000<br/>━━━━━━━━━━<br/>Card Search by ID/Name<br/>Price History<br/>Set Queries<br/><br/>HPA: 1-3 replicas<br/>384Mi-768Mi RAM<br/>250m-500m CPU"]
        
        Collection["Collection Service<br/>Port: 3000<br/>━━━━━━━━━━<br/>User Card Collections<br/>Collection Management<br/><br/>HPA: 1-3 replicas<br/>384Mi-768Mi RAM<br/>250m-500m CPU"]
        
        Listing["Listing Service<br/>Port: 3000<br/>━━━━━━━━━━<br/>Card Listings<br/>Marketplace<br/><br/>HPA: 1-3 replicas<br/>512Mi-1Gi RAM<br/>250m-1 CPU"]
    end

    subgraph "Data Layer"
        NATS["NATS Message Queue<br/>━━━━━━━━━━<br/>URL: nats://nats-srv:4222<br/>Cluster ID: mtg-tracker<br/>JetStream Enabled<br/><br/>Event-driven communication"]
        
        MySQL["MySQL 8.0<br/>━━━━━━━━━━<br/>Host: mysql:3306<br/>Database: mtgtrackerdb<br/><br/>Tables:<br/>• users<br/>• cards<br/>• card_prices<br/>• sets<br/>• trending_cards<br/>• card_listings<br/>• user_card_collection<br/>• user_collection_cache<br/><br/>StatefulSet:<br/>• 20Gi Longhorn PVC<br/>• InnoDB buffer: 2GB<br/>• Max connections: 200<br/>• 3-4Gi RAM<br/>• 500m-2 CPU"]
        
        Redis["Redis 7<br/>━━━━━━━━━━<br/>Host: redis-srv:6379<br/><br/>Caching:<br/>• Trending cards (24h/7d USD)<br/>• 24h TTL<br/><br/>HPA: 1-3 replicas<br/>256Mi-512Mi RAM<br/>100m-500m CPU"]
    end

    subgraph "External Services"
        Scryfall["Scryfall API<br/>━━━━━━━━━━<br/>Card Data Import<br/>Price Data Import<br/>Set Information"]
    end

    subgraph "Observability Stack"
        Grafana["Grafana 11.0.0<br/>Port: 3000<br/>LB: 192.168.1.170"]
        Loki["Loki 3.5.7<br/>SingleBinary Mode<br/>Gateway: 80<br/>Direct: 3100<br/>10Gi PVC"]
        Promtail["Promtail 3.5.1<br/>DaemonSet<br/>Log Collector"]
    end

    Client -->|HTTP/HTTPS| Ingress
    Ingress -->|Route| Auth
    Ingress -->|Route| Bulk
    Ingress -->|Route| Search
    Ingress -->|Route| Collection
    Ingress -->|Route| Listing

    Auth -->|Query| MySQL
    Bulk -->|Write/Read| MySQL
    Search -->|Query| MySQL
    Search -->|Cache Read/Write| Redis
    Collection -->|Write/Read| MySQL
    Listing -->|Write/Read| MySQL

    Collection -->|Events| NATS
    Listing -->|Events| NATS

    Bulk -.->|Import| Scryfall

    Auth -.->|Pino Logs| Promtail
    Bulk -.->|Pino Logs| Promtail
    Search -.->|Pino Logs| Promtail
    Collection -.->|Pino Logs| Promtail
    Listing -.->|Pino Logs| Promtail
    
    Promtail -->|Push Logs| Loki
    Grafana -->|Query Logs| Loki

    classDef service fill:#326ce5,stroke:#fff,stroke-width:2px,color:#fff
    classDef data fill:#13aa52,stroke:#fff,stroke-width:2px,color:#fff
    classDef external fill:#ff6b6b,stroke:#fff,stroke-width:2px,color:#fff
    classDef observability fill:#ffa500,stroke:#fff,stroke-width:2px,color:#fff
    classDef infra fill:#6c757d,stroke:#fff,stroke-width:2px,color:#fff

    class Auth,Bulk,Search,Collection,Listing service
    class MySQL,NATS data
    class Scryfall external
    class Grafana,Loki,Promtail observability
    class Client,Ingress infra
```

### Infrastructure
- **Kubernetes**: 3-node cluster
- **Storage**: Longhorn for persistent volumes
- **GitOps**: ArgoCD for automated image updates
- **Development**: Skaffold for local development
- **Namespaces**: default (services), loki (observability)
- **Autoscaling**: Horizontal Pod Autoscalers (HPA) on all services
  - Scale based on CPU (80%) and Memory (85%) utilization
  - Conservative scaling policies to prevent flapping

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
