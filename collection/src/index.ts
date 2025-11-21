import mysql from 'mysql2/promise';
import path from 'path';
import { app } from "./app";
import { createMysqlPoolWithRetry } from './config/mysql';
import { runMigrations } from '@mtg-tracker/common';
import { UserCardCollection } from './models/user-card-collection';
import { natsWrapper } from './nats-wrapper';


let pool: mysql.Pool | undefined;

const start = async () => {
  if (!process.env.NATS_URL) {
    throw new Error("NATS_URL must be defined");
  }

  if (!process.env.NATS_CLUSTER_ID) {
    throw new Error("NATS_CLUSTER_ID must be defined");
  }

  if (!process.env.NATS_CLIENT_ID) {
    throw new Error("NATS_CLIENT_ID must be defined");
  }

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
    console.log("Connecting to MySQL with the following config:");
    console.log(`Host: ${process.env.MYSQL_HOST}`);
    console.log(`User: ${process.env.MYSQL_USER}`);
    console.log(`Database: ${process.env.MYSQL_DATABASE}`);
  }

  // Connect to NATS
  try {
    await natsWrapper.connect(
      process.env.NATS_URL,
      process.env.NATS_CLUSTER_ID,
      process.env.NATS_CLIENT_ID
    );
    console.log('Connected to NATS JetStream');
  } catch (err) {
    console.error('Failed to connect to NATS:', err);
    throw err;
  }

  pool = await createMysqlPoolWithRetry({ retries: 20, delay: 3000 });
  // You can export the pool or set it in a global variable if needed
  console.log('pool created:', pool !== undefined);

  if (!pool) {
    throw new Error("Failed to create database pool");
  }

  // Run migrations from the migrations folder
  // Use process.cwd() to get the project root, then navigate to src/migrations
  const migrationsDir = path.join(process.cwd(), 'src', 'migrations');
  await runMigrations(pool, migrationsDir, 'collection');

  // Initialize models with database pool
  UserCardCollection.setPool(pool);

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.log(`Listening on port ${port}!`);
  });
};

start();

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing connections...");
  await natsWrapper.close();
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing connections...");
  await natsWrapper.close();
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});