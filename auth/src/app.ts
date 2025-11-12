import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";

// Import routes here and use them
import { newUserRouter } from "./routes/newuser";
import { currentUserRouter } from "./routes/current-user";
import { userSignoutRouter } from "./routes/signout-user";
import { userSigninRouter } from "./routes/signin-user";

import { healthRouter } from "./routes/health";
import { errorHandler } from "./middlewares/error-handler";


const app = express();
app.set("trust proxy", true);
app.use(json());

// CORS middleware - must be before routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3000', 'https://mtg-tracker.local'];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use((req, res, next) => {
  const clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('Client IP:', clientIP);
  next();
});

app.use(
  cookieSession({
    signed: false,
    secure: false, // Set to false to allow cookies over HTTP in dev
    sameSite: 'none', // Changed to 'none' to allow cross-origin cookies
    httpOnly: true, // Prevent JavaScript access to cookies for security
  })
);

console.log("Auth service up and running!!");
// Use the imported routes here
app.use(healthRouter);
app.use(newUserRouter);
app.use(currentUserRouter);
app.use(userSignoutRouter);
app.use(userSigninRouter);

// Error handler must be added AFTER all routes
app.use(errorHandler);

export { app };