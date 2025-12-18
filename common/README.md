# @mtg-tracker/common

Shared utility library for the MTG Tracker microservices. This package provides common errors, middleware, logging utilities, and database migration tools used across all services.

## Installation

```bash
npm install @mtg-tracker/common
```

## Exports

### Functions

#### `runMigrations(pool, migrationsDir, service)`
Automatically runs SQL migrations for a service. Creates a service-specific migrations tracking table and executes all SQL files in the migrations directory that haven't been run yet.

**Parameters:**
- `pool` (mysql.Pool) - MySQL2 connection pool
- `migrationsDir` (string) - Absolute path to the migrations directory
- `service` (string) - Service name for tracking migrations

**Example:**
```typescript
import { runMigrations } from '@mtg-tracker/common';
import pool from './database';

await runMigrations(pool, path.join(__dirname, 'migrations'), 'auth');
```

### Error Classes

All error classes extend `CustomError` and provide consistent error serialization across services.

#### `BadRequestError`
HTTP 400 error for invalid request data.

#### `CustomError` (abstract)
Base class for all custom errors. Provides:
- `statusCode` property
- `serializeErrors()` method for consistent error formatting

#### `DatabaseConnectionError`
HTTP 500 error for database connection failures.

#### `NotAuthorizedError`
HTTP 401 error for unauthorized access attempts.

#### `NotFoundError`
HTTP 404 error for missing resources.

#### `RequestValidationError`
HTTP 400 error for request validation failures. Integrates with `express-validator`.

### Middleware

#### `currentUser`
Extracts and verifies JWT from session, attaches user payload to `req.currentUser`.

**User Payload:**
```typescript
{
  id: number;
  email: string;
  username: string;
  role: 'user' | 'admin';
}
```

**Example:**
```typescript
import { currentUser } from '@mtg-tracker/common';

app.use(currentUser);
```

#### `requireAuth`
Ensures user is authenticated. Throws `NotAuthorizedError` if `req.currentUser` is not set.

**Example:**
```typescript
import { requireAuth } from '@mtg-tracker/common';

router.get('/protected', requireAuth, (req, res) => {
  // User is guaranteed to be authenticated
});
```

#### `requireAdmin`
Ensures user is authenticated AND has admin role. Throws `NotAuthorizedError` if user is not authenticated or not an admin.

**Example:**
```typescript
import { requireAdmin } from '@mtg-tracker/common';

router.delete('/admin/users/:id', requireAdmin, (req, res) => {
  // User is guaranteed to be an admin
});
```

#### `validateRequest`
Validates request using express-validator results. Throws `RequestValidationError` if validation fails.

**Example:**
```typescript
import { body } from 'express-validator';
import { validateRequest } from '@mtg-tracker/common';

router.post(
  '/users',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
  ],
  validateRequest,
  (req, res) => {
    // Request is validated
  }
);
```

#### `errorHandler`
Global error handler middleware. Catches all errors and returns consistent JSON responses.

**Example:**
```typescript
import { errorHandler } from '@mtg-tracker/common';

// Add as last middleware
app.use(errorHandler);
```

### Logging

#### `ServiceLogger`
Pino-based logger with custom log levels and pretty printing in development.

**Features:**
- Custom log levels: trace, debug, log, info, warn, error, fatal
- Color-coded output in development
- JSON output in production (for Loki/Grafana)
- Service name prefix on all logs

**Example:**
```typescript
import { ServiceLogger } from '@mtg-tracker/common';

const logger = new ServiceLogger('auth');

logger.log('Server starting...');
logger.info('User created', { userId: 123 });
logger.error('Database error', error);
```

## Usage Pattern

Typical service setup:

```typescript
import express from 'express';
import { 
  currentUser, 
  errorHandler, 
  requireAuth,
  ServiceLogger,
  runMigrations 
} from '@mtg-tracker/common';

const app = express();
const logger = new ServiceLogger('my-service');

// Middleware
app.use(express.json());
app.use(currentUser);

// Routes
app.get('/api/protected', requireAuth, (req, res) => {
  res.json({ user: req.currentUser });
});

// Error handling (must be last)
app.use(errorHandler);

// Database migrations
await runMigrations(pool, path.join(__dirname, 'migrations'), 'my-service');

// Start server
app.listen(3000, () => {
  logger.log('Service started on port 3000');
});
```

## Dependencies

- `express` - Web framework
- `jsonwebtoken` - JWT verification
- `mysql2` - MySQL database driver
- `pino` - Logging library
- `pino-pretty` - Pretty log formatter for development
- `express-validator` - Request validation

## Environment Variables

- `JWT_KEY` - Secret key for JWT verification (required)
- `LOG_LEVEL` - Pino log level (default: 'trace')
- `NODE_ENV` - Set to 'production' for JSON logging
