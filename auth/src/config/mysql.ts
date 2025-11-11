import mysql from 'mysql2/promise';

export async function createMysqlPoolWithRetry({
  retries = 10,
  delay = 2000,
} = {}) {
  const pool = mysql.createPool({
    host: 'mysql',
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
    database: process.env.MYSQL_DATABASE!,
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  while (retries > 0) {
    try {
      console.log("Attempting MySQL connection...");

      // Test connection by getting a connection from pool
      const conn = await pool.getConnection();

      // Optional test query
      await conn.query("SELECT 1");

      conn.release();

      console.log("MySQL pool connected successfully!");
      return pool;

    } catch (err) {
      retries -= 1;
      console.error(`MySQL connection failed. Retries left: ${retries}`);
      console.error("Error:", err instanceof Error ? err.message : String(err));

      if (retries === 0) {
        console.error("Out of retries. MySQL is unreachable.");
        throw err;
      }

      // Delay before retry
      await new Promise(res => setTimeout(res, delay));
    }
  }
}