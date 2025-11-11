import mysql from 'mysql2';
import { app } from "./app";

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

  // mysql://authuser:authpass@mysql:3306/authdb

  const connection = mysql.createConnection({
    host: 'mysql', // Replace with your MySQL host (e.g., '127.0.0.1')
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: 3306
  });

  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
      return;
    }
    console.log('Connected to the MySQL database!');
  });



  app.listen(3000, () => {
    console.log("Listening on port 3000!!!!");
  });
};

start();