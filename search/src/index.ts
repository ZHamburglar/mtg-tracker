import mysql from 'mysql2/promise';
import { app } from "./app";
import { createMysqlPoolWithRetry } from './config/mysql';
import { Card } from './models/card';
import { CardPrice } from './models/cardprice';
import { TrendingCard } from './models/trending-card';



let pool: mysql.Pool | undefined;

const start = async () => {
  console.log('[Search Service] Starting up...', {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  if (!process.env.MYSQL_HOST) {
    throw new Error("MYSQL_HOST must be defined");
  }

  if (!process.env.MYSQL_USER) {
    throw new Error("MYSQL_USER must be defined");
  }

  if (!process.env.MYSQL_PASSWORD) {
    throw new Error("MYSQL_PASSWORD must be defined");
  }

  if (!process.env.MYSQL_DATABASE) {
    throw new Error("MYSQL_DATABASE must be defined");
  }

  console.log("[Search Service] MySQL configuration:", {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DATABASE
  });

  console.log("[Search Service] Connecting to MySQL...");
  pool = await createMysqlPoolWithRetry({ retries: 20, delay: 3000 });
  console.log('[Search Service] MySQL pool created successfully');

  if (!pool) {
    throw new Error("Failed to create database pool");
  }

  // Run migrations from the migrations folder
  // Use process.cwd() to get the project root, then navigate to src/migrations
  // const migrationsDir = path.join(process.cwd(), 'src', 'migrations');
  // await runMigrations(pool, migrationsDir, 'search');

  // Initialize models with database pool
  console.log('[Search Service] Initializing models...');
  Card.setPool(pool);
  CardPrice.setPool(pool);
  TrendingCard.setPool(pool);
  console.log('[Search Service] Models initialized: Card, CardPrice, TrendingCard');

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.log(`[Search Service] Server started successfully`, {
      port,
      timestamp: new Date().toISOString()
    });
  });
};

start().catch(err => {
  console.error('[Search Service] Fatal error during startup', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("[Search Service] SIGINT received, shutting down gracefully...", {
    timestamp: new Date().toISOString()
  });
  if (pool) {
    await pool.end();
    console.log("[Search Service] Database connection closed");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Search Service] SIGTERM received, shutting down gracefully...", {
    timestamp: new Date().toISOString()
  });
  if (pool) {
    await pool.end();
    console.log("[Search Service] Database connection closed");
  }
  process.exit(0);
});