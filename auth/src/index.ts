import mysql from 'mysql2/promise';
import { app } from "./app";
import { createMysqlPoolWithRetry } from './config/mysql';
import { runMigrations } from './runMigrations';
import { User } from './models/user';

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
    console.log("Connecting to MySQL with the following config:");
    console.log(`Host: ${process.env.MYSQL_HOST}`);
    console.log(`User: ${process.env.MYSQL_USER}`);
    console.log(`Database: ${process.env.MYSQL_DATABASE}`);
  }


  pool = await createMysqlPoolWithRetry({ retries: 20, delay: 3000 });
  // You can export the pool or set it in a global variable if needed
  console.log('pool created:', pool !== undefined);

  if (!pool) {
    throw new Error("Failed to create database pool");
  }

  // Run migrations from the migrations folder
  await runMigrations(pool, 'auth');

  // Initialize User model with database pool
  User.setPool(pool);

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.log(`Listening on port ${port}!`);
  });
};

start();

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing database connection...");
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing database connection...");
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});
