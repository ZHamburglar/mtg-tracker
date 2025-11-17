import mysql from 'mysql2/promise';
import { User } from '../models/user';

let connection: mysql.Connection;

beforeAll(async () => {
  process.env.JWT_KEY = 'test-jwt-secret';
  
  // Create MySQL connection for testing
  connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DATABASE || 'mtg_auth_test',
    multipleStatements: true
  });

  // Create users table for testing
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      is_active BOOLEAN DEFAULT TRUE,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Set up connection pool for User model
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DATABASE || 'mtg_auth_test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  User.setPool(pool);
});

beforeEach(async () => {
  // Clear users table before each test
  await connection.execute('DELETE FROM users');
});

afterAll(async () => {
  await connection.end();
});