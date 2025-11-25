import mysql from 'mysql2/promise';
import { app } from "./app";
import { createMysqlPoolWithRetry } from './config/mysql';
import { Card } from './models/card';
import { CardPrice } from './models/cardprice';
import { TrendingCard } from './models/trending-card';
import { Set } from './models/set';

import { logger } from './logger';

let pool: mysql.Pool | undefined;

const start = async () => {
  logger.info('Starting up...', {
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

  logger.log("MySQL configuration:", {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DATABASE
  });

  logger.log("Connecting to MySQL...");
  pool = await createMysqlPoolWithRetry({ retries: 20, delay: 3000 });
  logger.info('MySQL pool created successfully');

  if (!pool) {
    throw new Error("Failed to create database pool");
  }

  // Run migrations from the migrations folder
  // Use process.cwd() to get the project root, then navigate to src/migrations
  // const migrationsDir = path.join(process.cwd(), 'src', 'migrations');
  // await runMigrations(pool, migrationsDir, 'search');

  // Initialize models with database pool
  logger.info('Initializing models...');
  Card.setPool(pool);
  CardPrice.setPool(pool);
  TrendingCard.setPool(pool);
  Set.setPool(pool);

  logger.info('Models initialized: Card, CardPrice, TrendingCard');
  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    logger.info('Server started successfully', {
      port,
      timestamp: new Date().toISOString()
    });
  });
};

start().catch(err => {
  logger.error('Fatal error during startup', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...", {
    timestamp: new Date().toISOString()
  });
  if (pool) {
    await pool.end();
    logger.info("Database connection closed");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...", {
    timestamp: new Date().toISOString()
  });
  if (pool) {
    await pool.end();
    logger.info("Database connection closed");
  }
  process.exit(0);
});