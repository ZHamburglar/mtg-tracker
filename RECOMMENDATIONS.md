# MTG Tracker Architecture Recommendations

This document outlines recommended improvements and missing components for the MTG Tracker architecture.

## Critical Missing Components

### 1. Backup & Disaster Recovery ⚠️ HIGH PRIORITY

**Current State**: No backup strategy for MySQL database

**Risks**:
- Complete data loss if PVC fails
- No recovery path from accidental deletions
- Cluster failures could result in permanent data loss

**Recommendations**:
```yaml
# Add CronJob for automated MySQL backups
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mysql-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mysql:8.0
            command:
            - /bin/sh
            - -c
            - |
              mysqldump -h mysql -u root -p$MYSQL_ROOT_PASSWORD \
                --all-databases --single-transaction \
                | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
              # Upload to S3/MinIO
              # Implement retention policy (keep 7 daily, 4 weekly, 12 monthly)
```

**Action Items**:
- [ ] Set up automated daily backups
- [ ] Store backups in external object storage (S3/MinIO)
- [ ] Implement backup retention policy
- [ ] Document and test restore procedures
- [ ] Add backup verification checks

---

### 2. Monitoring & Alerting ⚠️ HIGH PRIORITY

**Current State**: Only Loki for log aggregation

**Missing**:
- No metrics collection (CPU, memory, request rates, error rates)
- No proactive alerting for issues
- No service health dashboards
- Limited visibility into system performance

**Recommendations**:

```yaml
# Prometheus Stack Components
Components:
  - Prometheus: Metrics collection and storage
  - AlertManager: Alert routing and notifications
  - Grafana: Dashboards (already installed)
  - Node Exporter: Host-level metrics
  - kube-state-metrics: Kubernetes object metrics

# Critical Alerts to Implement
Alerts:
  - MySQL buffer pool usage > 80%
  - Service restart loops (>3 restarts in 10 minutes)
  - API error rate > 5%
  - Disk space < 20%
  - Memory usage > 90%
  - Response time p95 > 1 second
  - Certificate expiration < 7 days
  - Failed cron job executions
```

**Metrics to Track**:
- Request rates per endpoint
- Response times (p50, p95, p99)
- Error rates by service
- Database connection pool utilization
- MySQL slow query counts
- Cache hit/miss rates (when Redis added)
- Active NATS connections

**Action Items**:
- [ ] Deploy Prometheus Operator or kube-prometheus-stack
- [ ] Configure ServiceMonitors for all services
- [ ] Set up AlertManager with Slack/email notifications
- [ ] Create Grafana dashboards for:
  - Service health overview
  - MySQL performance
  - API request patterns
  - Error tracking
- [ ] Define SLOs (Service Level Objectives) for critical paths

---

### 3. Rate Limiting & DDoS Protection

**Current State**: No rate limiting on API endpoints

**Risks**:
- API abuse from malicious actors
- Resource exhaustion from runaway clients
- No protection against scraping/harvesting
- Uncontrolled costs from excessive Scryfall API calls

**Recommendations**:

```typescript
// Service-level rate limiting
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});

// Strict rate limit for expensive operations
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Search rate limit exceeded.'
});

app.use('/api/', apiLimiter);
app.use('/api/search', searchLimiter);
```

```yaml
# Ingress-level rate limiting (nginx)
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-connections: "50"
```

**Action Items**:
- [ ] Add express-rate-limit to all services
- [ ] Configure ingress rate limiting
- [ ] Implement IP-based throttling
- [ ] Add rate limit headers to responses
- [ ] Create whitelists for trusted clients
- [ ] Monitor rate limit violations

---

### 4. Authentication & Authorization

**Current State**: Auth service exists but enforcement unclear

**Gaps**:
- No JWT validation middleware visible on protected routes
- Unclear which endpoints require authentication
- No role-based access control (RBAC)
- Missing API key support for programmatic access

**Recommendations**:

```typescript
// Implement auth middleware across all protected routes
import { requireAuth } from '@mtg-tracker/common';

// Collection routes - require authentication
router.post('/api/collection', requireAuth, async (req, res) => {
  // Only authenticated users can manage collections
});

// Listing routes - require authentication
router.post('/api/listing', requireAuth, async (req, res) => {
  // Only authenticated users can create listings
});

// Public routes - no auth required
router.get('/api/search/:id', async (req, res) => {
  // Public card search
});
```

**RBAC Implementation**:
```typescript
// User roles
enum Role {
  USER = 'user',
  ADMIN = 'admin',
  API_CLIENT = 'api_client'
}

// Role-based middleware
const requireRole = (roles: Role[]) => {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.status(401).send({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).send({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Admin-only routes
router.delete('/api/bulk/cards/all', requireRole([Role.ADMIN]), async (req, res) => {
  // Only admins can bulk delete
});
```

**Action Items**:
- [ ] Audit all endpoints and classify (public/authenticated/admin)
- [ ] Add requireAuth middleware to protected routes
- [ ] Implement role-based access control
- [ ] Add API key authentication for external integrations
- [ ] Create user management endpoints
- [ ] Add session management and token refresh

---

### 5. Caching Layer (Redis)

**Current State**: No caching - every request hits MySQL

**Performance Impact**:
- Repeated queries for same popular cards
- Set metadata fetched on every search
- Trending cards recalculated instead of cached
- Unnecessary database load

**Recommendations**:

```yaml
# Redis Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

**Cache Strategy**:
```typescript
// Card caching
Cache Key Pattern: card:{id}
TTL: 1 hour (cards rarely change)

// Price caching
Cache Key Pattern: price:latest:{card_id}
TTL: 5 minutes (prices update daily)

// Trending cards caching
Cache Key Pattern: trending:{timeframe}:{price_type}:{direction}
TTL: 1 hour (updated at 00:30 daily)

// Set metadata caching
Cache Key Pattern: sets:all
TTL: 24 hours (sets rarely change)

// Search results caching
Cache Key Pattern: search:{hash(params)}
TTL: 10 minutes
```

**Implementation**:
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// Cache middleware
async function getCachedCard(id: string) {
  const cached = await redis.get(`card:${id}`);
  if (cached) return JSON.parse(cached);
  
  const card = await Card.findById(id);
  if (card) {
    await redis.setex(`card:${id}`, 3600, JSON.stringify(card));
  }
  return card;
}
```

**Action Items**:
- [ ] Deploy Redis to cluster
- [ ] Add redis client to common package
- [ ] Implement caching for hot paths:
  - Card lookups by ID
  - Latest prices
  - Trending cards
  - Set metadata
- [ ] Add cache warming for trending cards after calculation
- [ ] Implement cache invalidation strategy
- [ ] Add cache hit/miss metrics

---

### 6. Service Mesh / API Gateway

**Current State**: Direct service-to-service communication via ingress

**Missing**:
- No distributed tracing across services
- No circuit breakers for fault tolerance
- No centralized request/response logging
- Limited traffic management capabilities

**Recommendations**:

**Option A: Service Mesh (Production-Grade)**
```yaml
# Istio or Linkerd
Benefits:
  - Automatic mTLS between services
  - Circuit breakers and retry logic
  - Traffic splitting for canary deployments
  - Distributed tracing out of the box
  - Advanced routing rules

Considerations:
  - Adds complexity
  - Resource overhead (~50-100MB per sidecar)
  - Recommended for production at scale
```

**Option B: Application-Level Patterns (Simpler)**
```typescript
// Circuit breaker implementation
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30 seconds
};

const breaker = new CircuitBreaker(fetchFromExternalAPI, options);

breaker.fallback(() => {
  return getCachedData(); // Return cached data on failure
});

breaker.on('open', () => {
  logger.error('Circuit breaker opened - service unhealthy');
});
```

**Action Items**:
- [ ] Evaluate service mesh vs application-level patterns
- [ ] Implement circuit breakers for external API calls (Scryfall)
- [ ] Add retry logic with exponential backoff
- [ ] Implement timeout patterns
- [ ] Add request correlation IDs for tracing

---

### 7. Database Connection Pooling Management

**Current State**: Each service creates its own pool, sharing 200 max connections

**Risks**:
- Connection exhaustion under load
- No visibility into connection usage per service
- Potential deadlocks during traffic spikes

**Current Connection Budget** (max 200):
```
- Bulk service: ~50 connections (heavy writes)
- Search service: ~40 connections (heavy reads)
- Collection service: ~30 connections
- Listing service: ~30 connections
- Auth service: ~10 connections
- Overhead: ~10 connections
= 170 connections (85% utilized)
```

**Recommendations**:

```typescript
// Add connection pool monitoring
import { ServiceLogger } from '@mtg-tracker/common';
const logger = new ServiceLogger('Search');

setInterval(async () => {
  const pool = Card.getPool();
  const metrics = {
    totalConnections: pool.pool._allConnections.length,
    activeConnections: pool.pool._allConnections.filter(c => c._busy).length,
    idleConnections: pool.pool._freeConnections.length,
    queuedRequests: pool.pool._connectionQueue.length
  };
  
  logger.info('Connection pool metrics', metrics);
  
  if (metrics.activeConnections > 35) {
    logger.warn('Connection pool utilization high', metrics);
  }
}, 60000); // Check every minute
```

**Connection Pooling Proxy** (Advanced):
```yaml
# ProxySQL deployment for connection pooling
Benefits:
  - Centralized connection management
  - Query caching
  - Read/write splitting
  - Connection multiplexing
  - Query routing and rewriting
```

**Action Items**:
- [ ] Add connection pool metrics to all services
- [ ] Set appropriate pool sizes per service:
  - Bulk: max 50
  - Search: max 40
  - Collection: max 30
  - Listing: max 30
  - Auth: max 10
- [ ] Monitor connection pool saturation
- [ ] Consider ProxySQL for production
- [ ] Add alerts for connection pool exhaustion

---

### 8. Health Checks & Liveness Probes ⚠️ HIGH PRIORITY

**Current State**: No health checks defined in deployments

**Risks**:
- Kubernetes routes traffic to unhealthy pods
- Failed pods stay in service rotation
- No automatic pod restarts on deadlock/hang
- Poor user experience from failed requests

**Recommendations**:

```typescript
// Add health check endpoints to all services
router.get('/health', async (req, res) => {
  // Liveness probe - is the service alive?
  res.status(200).json({ status: 'ok' });
});

router.get('/ready', async (req, res) => {
  // Readiness probe - can the service handle traffic?
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check NATS connection (if applicable)
    if (natsClient && !natsClient.connected) {
      throw new Error('NATS not connected');
    }
    
    res.status(200).json({ 
      status: 'ready',
      database: 'connected',
      nats: natsClient?.connected ? 'connected' : 'n/a'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: error.message 
    });
  }
});
```

```yaml
# Add to all service deployments
spec:
  containers:
  - name: service-name
    livenessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 3
```

**Action Items**:
- [ ] Add /health and /ready endpoints to all services
- [ ] Update all deployment manifests with probes
- [ ] Test probe behavior (simulate DB disconnect)
- [ ] Monitor probe failures in logs
- [ ] Document probe expectations

---

### 9. CI/CD Pipeline

**Current State**: ArgoCD for image updates only

**Missing**:
- No automated testing before deployment
- No integration tests
- Manual verification required
- No deployment notifications
- No automated rollback

**Recommendations**:

```yaml
# GitHub Actions Workflow
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run unit tests
        run: npm test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Lint code
        run: npm run lint
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: docker build -t $IMAGE_TAG .
      
      - name: Push to registry
        run: docker push $IMAGE_TAG
      
      - name: Notify deployment started
        uses: 8398a7/action-slack@v3
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: kubectl apply -f k8s/
      
      - name: Run smoke tests
        run: npm run test:smoke
      
      - name: Rollback on failure
        if: failure()
        run: kubectl rollout undo deployment/service-name
```

**Testing Strategy**:
```typescript
// Unit tests
describe('Card.findById', () => {
  it('should return card when found', async () => {
    const card = await Card.findById('test-id');
    expect(card).toBeDefined();
    expect(card.id).toBe('test-id');
  });
});

// Integration tests
describe('GET /api/search/:id', () => {
  it('should return 200 with valid card', async () => {
    const response = await request(app)
      .get('/api/search/valid-id')
      .expect(200);
    expect(response.body.card).toBeDefined();
  });
});

// Smoke tests (production verification)
describe('Production Health', () => {
  it('all services should be healthy', async () => {
    const services = ['bulk', 'search', 'collection', 'listing', 'auth'];
    for (const service of services) {
      const response = await fetch(`https://mtg-tracker.local/api/${service}/health`);
      expect(response.status).toBe(200);
    }
  });
});
```

**Action Items**:
- [ ] Set up GitHub Actions workflows
- [ ] Write unit tests for critical paths
- [ ] Create integration test suite
- [ ] Add pre-commit hooks (linting, formatting)
- [ ] Configure deployment notifications (Slack/Discord)
- [ ] Implement automated rollback on failure
- [ ] Add staging environment for pre-production testing

---

### 10. Data Validation & Sanitization

**Current State**: Some validation with express-validator

**Risks**:
- SQL injection vulnerabilities
- XSS attacks through user input
- Invalid data causing application errors
- Data integrity issues

**Recommendations**:

```typescript
// Input validation middleware
import { body, param, query, validationResult } from 'express-validator';

// Card search validation
router.get('/api/search',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('page').optional().isInt({ min: 1 }),
    query('name').optional().trim().escape(),
    query('rarity').optional().isIn(['common', 'uncommon', 'rare', 'mythic']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process request
  }
);

// Sanitization utility
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
```

**Database Constraints**:
```sql
-- Add constraints to prevent invalid data
ALTER TABLE cards
  ADD CONSTRAINT chk_cmc CHECK (cmc >= 0),
  ADD CONSTRAINT chk_rarity CHECK (rarity IN ('common', 'uncommon', 'rare', 'mythic'));

ALTER TABLE card_prices
  ADD CONSTRAINT chk_price_positive CHECK (
    (price_usd IS NULL OR price_usd >= 0) AND
    (price_usd_foil IS NULL OR price_usd_foil >= 0) AND
    (price_eur IS NULL OR price_eur >= 0)
  );
```

**Action Items**:
- [ ] Add validation to all POST/PUT endpoints
- [ ] Implement input sanitization
- [ ] Add database constraints
- [ ] Validate foreign key references before inserts
- [ ] Add schema validation for complex objects
- [ ] Test with malicious inputs

---

## Nice-to-Have Improvements

### 11. API Documentation

**Recommendation**: Swagger/OpenAPI documentation

```typescript
// Install swagger
npm install swagger-ui-express swagger-jsdoc

// Configure Swagger
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MTG Tracker API',
      version: '1.0.0',
      description: 'Magic: The Gathering card tracking and pricing API'
    },
    servers: [
      { url: 'https://mtg-tracker.local', description: 'Production' }
    ]
  },
  apis: ['./src/routes/*.ts']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
```

**Action Items**:
- [ ] Add Swagger to each service
- [ ] Document all endpoints with JSDoc comments
- [ ] Include request/response examples
- [ ] Add authentication documentation
- [ ] Publish public API docs

---

### 12. Load Testing

**Recommendation**: Regular load testing to identify bottlenecks

```javascript
// k6 load test example
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% errors
  },
};

export default function() {
  let response = http.get('https://mtg-tracker.local/api/search?name=Lightning');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**Action Items**:
- [ ] Set up k6 or similar tool
- [ ] Create load test scenarios for critical paths
- [ ] Run tests before major releases
- [ ] Establish performance baselines
- [ ] Test autoscaling behavior

---

### 13. Secret Management

**Current State**: Kubernetes secrets (base64 encoded)

**Recommendation**: External secret management

```yaml
# Sealed Secrets (GitOps friendly)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: mysql-secret
spec:
  encryptedData:
    MYSQL_PASSWORD: AgBQ7Vl...encrypted...

# Or External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: mysql-secret
spec:
  secretStoreRef:
    name: vault-backend
  target:
    name: mysql-secret
  data:
  - secretKey: MYSQL_PASSWORD
    remoteRef:
      key: mysql/credentials
      property: password
```

**Action Items**:
- [ ] Evaluate Sealed Secrets vs Vault vs External Secrets Operator
- [ ] Implement secret rotation
- [ ] Remove plaintext secrets from version control
- [ ] Add secret expiration monitoring

---

### 14. Multi-Environment Setup

**Recommendation**: Separate dev/staging/production

```bash
# Namespace structure
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace production

# Environment-specific configs
k8s/
  base/           # Shared resources
  overlays/
    dev/          # Dev-specific (relaxed limits, debug logging)
    staging/      # Staging (production-like, test data)
    production/   # Production (strict limits, optimized)
```

**Action Items**:
- [ ] Create namespace per environment
- [ ] Use Kustomize for environment overlays
- [ ] Different resource limits per environment
- [ ] Separate databases per environment
- [ ] Environment-specific ingress domains

---

### 15. Cost Optimization

**Recommendations**:

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: search-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: search-depl
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Action Items**:
- [ ] Add HPA to all services
- [ ] Implement pod disruption budgets
- [ ] Use spot instances for non-critical workloads
- [ ] Right-size resource requests/limits
- [ ] Monitor resource utilization

---

### 16. Database Read Replicas

**Recommendation**: Separate read/write workloads

```typescript
// Primary for writes
const primaryPool = mysql.createPool({
  host: process.env.MYSQL_PRIMARY_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

// Replica for reads
const replicaPool = mysql.createPool({
  host: process.env.MYSQL_REPLICA_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

// Route queries appropriately
class Card {
  static async findById(id: string) {
    // Read from replica
    const [rows] = await replicaPool.query('SELECT * FROM cards WHERE id = ?', [id]);
    return rows[0];
  }
  
  static async create(card: CardData) {
    // Write to primary
    await primaryPool.query('INSERT INTO cards SET ?', card);
  }
}
```

**Action Items**:
- [ ] Set up MySQL replication
- [ ] Route reads to replica
- [ ] Monitor replication lag
- [ ] Handle replica failover

---

### 17. API Versioning

**Recommendation**: Version API endpoints

```typescript
// Current: /api/search
// Better: /api/v1/search

// Support multiple versions simultaneously
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Deprecation headers
app.use('/api/v1', (req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('X-API-Deprecated', 'This API version will be sunset on 2026-01-01');
  next();
});
```

**Action Items**:
- [ ] Plan versioning strategy
- [ ] Implement version routing
- [ ] Add deprecation warnings
- [ ] Document version lifecycle

---

### 18. Distributed Tracing

**Recommendation**: OpenTelemetry or Jaeger

```typescript
// OpenTelemetry instrumentation
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});
```

**Action Items**:
- [ ] Deploy Jaeger or use managed tracing
- [ ] Add OpenTelemetry to services
- [ ] Trace requests across service boundaries
- [ ] Add custom spans for critical operations

---

## Implementation Priority

### Phase 1: Stability & Reliability (Weeks 1-2)
1. ✅ Health checks and liveness probes
2. ✅ Database backups
3. ✅ Monitoring and alerting (Prometheus stack)

### Phase 2: Performance & Scalability (Weeks 3-4)
4. Redis caching layer
5. Connection pool optimization
6. Rate limiting
7. HPA for autoscaling

### Phase 3: Security & Best Practices (Weeks 5-6)
8. Auth enforcement on all protected routes
9. Input validation and sanitization
10. Secret management (Sealed Secrets)

### Phase 4: Developer Experience (Weeks 7-8)
11. CI/CD pipeline with automated testing
12. API documentation (Swagger)
13. Multi-environment setup

### Phase 5: Advanced Features (Future)
14. Service mesh or circuit breakers
15. Distributed tracing
16. Database read replicas
17. Load testing framework
18. API versioning

---

## Quick Wins (Implement First)

These can be done quickly and have immediate impact:

1. **Health checks** - 1-2 hours per service
2. **Rate limiting** - 30 minutes per service
3. **Connection pool logging** - 1 hour
4. **Input validation** - 2-3 hours
5. **ENABLE_CRON environment variable** - ✅ Already done

---

## Monitoring Metrics to Track

Once monitoring is implemented, track these key metrics:

### Application Metrics
- Request rate (requests/second)
- Error rate (% of failed requests)
- Response time (p50, p95, p99)
- Concurrent requests

### Database Metrics
- Connection pool utilization
- Query execution time
- Slow query count
- Buffer pool hit rate
- Replication lag (if replicas added)

### Infrastructure Metrics
- CPU utilization per pod
- Memory utilization per pod
- Network I/O
- Disk I/O
- Pod restart count

### Business Metrics
- Cards imported per day
- Searches per day
- Active users
- API key usage
- Cache hit rate

---

## Summary

The MTG Tracker architecture is solid but has several gaps that should be addressed for production readiness:

**Must Have** (before production):
- Health checks
- Monitoring/alerting
- Database backups
- Rate limiting
- Auth enforcement

**Should Have** (for scale):
- Redis caching
- Connection pool management
- CI/CD pipeline
- Load testing

**Nice to Have** (for maturity):
- Service mesh
- Distributed tracing
- Read replicas
- Multi-environment setup

Focus on **Phase 1** items first to ensure stability, then iterate on performance and features.
