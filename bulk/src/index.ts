import mysql from 'mysql2/promise';
import path from 'path';
import { app } from "./app";
import { createMysqlPoolWithRetry } from './config/mysql';
import { runMigrations } from '@mtg-tracker/common';

import { Card } from './models/card';
import { CardPrice } from './models/cardprice';
import { Set } from './models/set';
import { TrendingCard } from './models/trending-card';
import { CardFace } from './models/cardface';

import { logger } from './logger';

let pool: mysql.Pool | undefined;

const start = async () => {
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

  if (process.env.MYSQL_DATABASE && process.env.MYSQL_PASSWORD && process.env.MYSQL_USER && process.env.MYSQL_HOST) {
    logger.info("Connecting to MySQL with the following config:");
    logger.info(`Host: ${process.env.MYSQL_HOST}`);
    logger.info(`User: ${process.env.MYSQL_USER}`);
    logger.info(`Database: ${process.env.MYSQL_DATABASE}`);
  }


  pool = await createMysqlPoolWithRetry({ retries: 20, delay: 3000 });
  // You can export the pool or set it in a global variable if needed
  logger.log('pool created:', pool !== undefined);

  if (!pool) {
    throw new Error("Failed to create database pool");
  }

  // Run migrations from the migrations folder
  // Use process.cwd() to get the project root, then navigate to src/migrations
  const migrationsDir = path.join(process.cwd(), 'src', 'migrations');
  logger.log('Starting migrations from:', migrationsDir);
  
  try {
    await runMigrations(pool, migrationsDir, 'bulk');
    logger.log('Migrations completed successfully');
  } catch (error) {
    logger.error('Error running migrations:', error);
    throw error;
  }

  // Initialize models with database pool
  Card.setPool(pool);
  CardPrice.setPool(pool);
  Set.setPool(pool);
  TrendingCard.setPool(pool);
  CardFace.setPool(pool);

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    logger.log(`Listening on port ${port}!`);
  });
};

start().catch(err => {
  logger.error('Fatal error during startup:', err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  logger.log("SIGINT received, closing database connection...");
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.log("SIGTERM received, closing database connection...");
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});